import type { FastifyInstance } from 'fastify';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { Job } from 'pg-boss';
import {
  SESSION_EVENTS_QUEUE,
  type SessionEventJobPayload,
} from '../types/event-queue.types.js';
import { insertSessionEventInTx } from '../db/helpers.js';

/**
 * セッションイベントをキューに追加する
 *
 * @param fastify - Fastify インスタンス
 * @param params - イベントパラメータ
 */
export function enqueueSessionEvent(
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
): void {
  const payload: SessionEventJobPayload = {
    userId: params.userId,
    sessionId: params.sessionUUID,
    eventUuid: params.eventUuid,
    type: params.type,
    subtype: params.subtype,
    message: params.message,
    createdAt: new Date().toISOString(),
  };

  // キューに追加（fire-and-forget だが pg-boss が永続化を保証）
  // singletonKey でセッション単位の順序を保証
  fastify.boss
    .send(SESSION_EVENTS_QUEUE, payload, {
      singletonKey: params.sessionId,
    })
    .catch((error: unknown) => {
      fastify.log.error(
        { sessionId: params.sessionId, eventUuid: params.eventUuid, error },
        'Failed to enqueue session event'
      );
    });
}

/**
 * イベントワーカーを登録する
 *
 * ワーカー設定:
 * - バッチサイズ: 1（セッション単位の順序保証）
 * - ポーリング間隔: 2秒
 *
 * @param fastify - Fastify インスタンス
 */
export async function registerEventWorker(fastify: FastifyInstance): Promise<void> {
  // キューを作成（存在しない場合）
  await fastify.boss.createQueue(SESSION_EVENTS_QUEUE, {
    retryLimit: 3,
    retryDelay: 5,
    retryBackoff: true,
    expireInSeconds: 30 * 60, // 30分
    retentionSeconds: 7 * 24 * 60 * 60, // 7日
  });
  fastify.log.info({ queue: SESSION_EVENTS_QUEUE }, 'Event queue created');

  await fastify.boss.work<SessionEventJobPayload>(
    SESSION_EVENTS_QUEUE,
    {
      batchSize: 1,
      pollingIntervalSeconds: 2,
    },
    async (jobs: Job<SessionEventJobPayload>[]) => {
      // batchSize: 1 なので、配列には1つのジョブしか入らない
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
