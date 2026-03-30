import type { FastifyInstance } from 'fastify';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { SessionEventJobPayload } from '../types/event-queue.types.js';
import { insertSessionEventInTx } from '../db/helpers.js';

declare module 'fastify' {
  interface FastifyInstance {
    eventBatcher: EventBatcher;
  }
}

/**
 * インメモリバッチバッファによるイベント永続化
 *
 * バッファにイベントを蓄積し、以下の条件で DB にフラッシュする:
 * - バッチサイズ到達（EVENT_PERSIST_BATCH_SIZE、デフォルト: 10）
 * - インターバル経過（EVENT_PERSIST_INTERVAL、デフォルト: 5.0 秒）
 */
export class EventBatcher {
  private buffer: SessionEventJobPayload[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private flushPromise: Promise<void> = Promise.resolve();

  constructor(
    private readonly fastify: FastifyInstance,
    private readonly batchSize: number,
    private readonly intervalMs: number
  ) {}

  /**
   * 定期フラッシュタイマーを開始する
   */
  start(): void {
    this.timer = setInterval(() => {
      this.flush().catch(err => {
        this.fastify.log.error({ err }, 'Periodic event flush failed');
      });
    }, this.intervalMs);
    // プロセス終了を阻害しない
    this.timer.unref();
    this.fastify.log.info(
      { batchSize: this.batchSize, intervalMs: this.intervalMs },
      'EventBatcher started'
    );
  }

  /**
   * イベントをバッファに追加する
   * バッチサイズ到達時は即時フラッシュをトリガーする
   */
  add(payload: SessionEventJobPayload): void {
    this.buffer.push(payload);
    if (this.buffer.length >= this.batchSize) {
      this.flush().catch(err => {
        this.fastify.log.error({ err }, 'Batch-size event flush failed');
      });
    }
  }

  /**
   * バッファ内の全イベントを DB にフラッシュする
   *
   * - バッファを swap してから INSERT（新イベントは新バッファに入る）
   * - 同一ユーザーのイベントは1トランザクションにまとめる
   * - flushing フラグで並行フラッシュを防止
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;

    this.flushing = true;
    const batch = this.buffer;
    this.buffer = [];

    const doFlush = async () => {
      try {
        // ユーザーごとにグループ化して同一トランザクションで処理
        const eventsByUser = new Map<string, SessionEventJobPayload[]>();
        for (const event of batch) {
          const events = eventsByUser.get(event.userId);
          if (events) {
            events.push(event);
          } else {
            eventsByUser.set(event.userId, [event]);
          }
        }

        const results = await Promise.allSettled(
          [...eventsByUser.entries()].map(async ([userId, events]) => {
            await this.fastify.withUserContext(userId, async tx => {
              for (const event of events) {
                await insertSessionEventInTx(tx, {
                  uuid: event.eventUuid,
                  sessionId: event.sessionId,
                  type: event.type,
                  subtype: event.subtype,
                  message: event.message,
                });
              }
            });
          })
        );

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
          const errors = failures.map(f => (f as PromiseRejectedResult).reason);
          this.fastify.log.error(
            { errors, batchSize: batch.length, failureCount: failures.length },
            'Some events failed to persist'
          );
        }
      } finally {
        this.flushing = false;
      }
    };

    this.flushPromise = doFlush();
    await this.flushPromise;
  }

  /**
   * タイマーを停止し、残りのイベントをフラッシュする（グレースフルシャットダウン用）
   */
  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // 実行中のフラッシュを待機してから残りをフラッシュ
    await this.flushPromise;
    await this.flush();
    this.fastify.log.info('EventBatcher shut down');
  }
}

/**
 * EventBatcher を初期化し、Fastify インスタンスにデコレートする
 *
 * - `fastify.eventBatcher` としてアクセス可能
 * - `onClose` フックでグレースフルシャットダウン
 *
 * @param fastify - Fastify インスタンス（config, db プラグイン登録済み）
 */
export async function startEventBatcher(fastify: FastifyInstance): Promise<void> {
  const batcher = new EventBatcher(
    fastify,
    fastify.config.EVENT_PERSIST_BATCH_SIZE,
    fastify.config.EVENT_PERSIST_INTERVAL * 1000
  );

  batcher.start();

  fastify.decorate('eventBatcher', batcher);

  fastify.addHook('onClose', async () => {
    fastify.log.info('Shutting down EventBatcher...');
    await batcher.shutdown();
  });
}

/**
 * セッションイベントをバッチバッファに追加する
 *
 * バッファに追加するだけの同期処理。
 * 実際の DB 永続化は EventBatcher がバッチサイズ到達 or インターバル経過時に行う。
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

  fastify.eventBatcher.add(payload);
}
