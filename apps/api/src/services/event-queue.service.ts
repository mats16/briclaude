import type { FastifyInstance } from 'fastify';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { SESSION_EVENTS_QUEUE, type SessionEventJobPayload } from '../types/event-queue.types.js';
import { insertSessionEventInTx } from '../db/helpers.js';

/**
 * セッションイベントをキューに追加する
 *
 * singletonKey でセッション単位の順序を保証しつつ、
 * pg-boss が永続化・リトライを保証する。
 *
 * @param fastify - Fastify インスタンス
 * @param params - イベントパラメータ
 * @returns Promise<void> - 呼び出し元でエラーハンドリング可能
 */
export async function enqueueSessionEvent(
  fastify: FastifyInstance,
  params: {
    userId: string;
    /** セッションID（TypeID 形式） */
    sessionId: string;
    /** セッションUUID（DB 用） */
    sessionUUID: string;
    eventUuid: string;
    type: string;
    subtype: string | null;
    message: SDKMessage;
  }
): Promise<void> {
  const payload: SessionEventJobPayload = {
    userId: params.userId,
    sessionId: params.sessionUUID,
    eventUuid: params.eventUuid,
    type: params.type,
    subtype: params.subtype,
    message: params.message,
    createdAt: new Date().toISOString(),
  };

  try {
    // singletonKey でセッション単位の順序を保証
    await fastify.boss.send(SESSION_EVENTS_QUEUE, payload, {
      singletonKey: params.sessionId,
    });
  } catch (error: unknown) {
    fastify.log.error(
      { sessionId: params.sessionId, eventUuid: params.eventUuid, error },
      'Failed to enqueue session event'
    );
    throw error;
  }
}

/**
 * イベントワーカーを登録する
 *
 * fetch() + complete()/fail() パターンを使用し、
 * 異なるセッションのジョブを並列処理しながら、
 * 個別ジョブの成功/失敗を制御する。
 *
 * ワーカー設定:
 * - バッチサイズ: 設定値（デフォルト: 10）
 *   singletonKey でセッション単位の順序は保証されるため、
 *   異なるセッションのイベントは並列処理可能
 * - ポーリング間隔: 設定値（デフォルト: 2秒）
 *
 * @param fastify - Fastify インスタンス
 */
export async function registerEventWorker(fastify: FastifyInstance): Promise<void> {
  const {
    PGBOSS_RETRY_LIMIT,
    PGBOSS_RETRY_DELAY,
    PGBOSS_EXPIRE_IN_SECONDS,
    PGBOSS_RETENTION_SECONDS,
    PGBOSS_BATCH_SIZE,
    PGBOSS_POLLING_INTERVAL_SECONDS,
  } = fastify.config;

  // キューを作成（存在しない場合）
  await fastify.boss.createQueue(SESSION_EVENTS_QUEUE, {
    retryLimit: PGBOSS_RETRY_LIMIT,
    retryDelay: PGBOSS_RETRY_DELAY,
    retryBackoff: true,
    expireInSeconds: PGBOSS_EXPIRE_IN_SECONDS,
    retentionSeconds: PGBOSS_RETENTION_SECONDS,
  });
  fastify.log.info({ queue: SESSION_EVENTS_QUEUE }, 'Event queue created');

  const intervalMs = PGBOSS_POLLING_INTERVAL_SECONDS * 1000;

  /**
   * ジョブをフェッチして並列処理する
   */
  const poll = async () => {
    const jobs = await fastify.boss.fetch<SessionEventJobPayload>(SESSION_EVENTS_QUEUE, {
      batchSize: PGBOSS_BATCH_SIZE,
    });

    if (!jobs || jobs.length === 0) return;

    // 並列処理
    const results = await Promise.allSettled(
      jobs.map(async job => {
        const { userId, sessionId, eventUuid, type, subtype, message } = job.data;
        await fastify.withUserContext(userId, async tx => {
          await insertSessionEventInTx(tx, {
            uuid: eventUuid,
            sessionId,
            type,
            subtype,
            message,
          });
        });
        return job.id;
      })
    );

    // 個別に complete/fail
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const job = jobs[i];

      if (result.status === 'fulfilled') {
        await fastify.boss.complete(SESSION_EVENTS_QUEUE, job.id);
      } else {
        fastify.log.error(
          { sessionId: job.data.sessionId, eventUuid: job.data.eventUuid, error: result.reason },
          'Failed to insert session event from queue'
        );
        await fastify.boss.fail(SESSION_EVENTS_QUEUE, job.id, result.reason);
      }
    }
  };

  /**
   * ポーリングループ
   * シャットダウンフラグが立つまで継続
   */
  const pollLoop = async () => {
    while (!fastify.isBossShuttingDown) {
      try {
        await poll();
      } catch (error) {
        fastify.log.error({ error }, 'Event queue polling error');
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    fastify.log.info('Event queue poll loop stopped');
  };

  // バックグラウンドで開始（await しない）
  pollLoop().catch(error => {
    fastify.log.error({ error }, 'Event queue poll loop crashed');
  });

  fastify.log.info('Event queue worker registered');
}
