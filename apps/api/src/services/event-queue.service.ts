import type { FastifyInstance } from 'fastify';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { Job } from 'pg-boss';
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

  await fastify.boss.work<SessionEventJobPayload>(
    SESSION_EVENTS_QUEUE,
    {
      batchSize: PGBOSS_BATCH_SIZE,
      pollingIntervalSeconds: PGBOSS_POLLING_INTERVAL_SECONDS,
    },
    async (jobs: Job<SessionEventJobPayload>[]) => {
      // バッチ処理: 異なるセッションのイベントは並列処理可能
      // singletonKey によりセッション内の順序は保証される
      for (const job of jobs) {
        const { userId, sessionId, eventUuid, type, subtype, message } = job.data;

        try {
          await fastify.withUserContext(userId, async tx => {
            await insertSessionEventInTx(tx, {
              uuid: eventUuid,
              sessionId,
              type,
              subtype,
              message,
            });
          });
        } catch (error) {
          fastify.log.error(
            { sessionId, eventUuid, error },
            'Failed to insert session event from queue'
          );
          throw error; // pg-boss にリトライさせる
        }
      }
    }
  );

  fastify.log.info('Event queue worker registered');
}
