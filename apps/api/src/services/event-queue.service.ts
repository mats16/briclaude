import type { FastifyInstance } from 'fastify';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { SessionEventJobPayload } from '../types/event-queue.types.js';
import { insertSessionEventInTx } from '../db/helpers.js';

declare module 'fastify' {
  interface FastifyInstance {
    eventBatcher: EventBatcher;
  }
}

/** リトライ定数 */
const RETRY_INITIAL_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;
const RETRY_MAX_ATTEMPTS = 5;

/**
 * インメモリバッチバッファによるイベント永続化
 *
 * バッファにイベントを蓄積し、以下の条件で DB にフラッシュする:
 * - バッチサイズ到達（EVENT_PERSIST_BATCH_SIZE、デフォルト: 10）
 * - インターバル経過（EVENT_PERSIST_INTERVAL、デフォルト: 5.0 秒）
 *
 * 書き込み失敗時はエクスポネンシャルバックオフでリトライする。
 * add() 時に enqueuedAt を確定させ、リトライ時も元の時刻で DB に書き込む。
 */
export class EventBatcher {
  private buffer: SessionEventJobPayload[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private flushPromise: Promise<void> = Promise.resolve();
  private shuttingDown = false;
  private retryTimers = new Set<ReturnType<typeof setTimeout>>();
  private activeRetries = new Set<Promise<void>>();

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
    this.buffer.push({ ...payload, enqueuedAt: new Date() });
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
   * - 失敗したユーザーグループはエクスポネンシャルバックオフでリトライ
   */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;

    this.flushing = true;
    const batch = this.buffer;
    this.buffer = [];

    const doFlush = async () => {
      try {
        const eventsByUser = this.groupByUser(batch);

        const userIds = [...eventsByUser.keys()];
        const results = await Promise.allSettled(
          userIds.map(async userId => {
            const events = eventsByUser.get(userId)!;
            await this.writeUserEvents(userId, events);
          })
        );

        for (let i = 0; i < results.length; i++) {
          if (results[i].status === 'rejected') {
            const userId = userIds[i];
            const events = eventsByUser.get(userId)!;
            const error = (results[i] as PromiseRejectedResult).reason;
            this.fastify.log.warn(
              { err: error, userId, eventCount: events.length },
              'Event flush failed for user, scheduling retry'
            );
            this.scheduleRetry(userId, events, 1);
          }
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
    this.shuttingDown = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    for (const timer of this.retryTimers) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    // 実行中のリトライの完了を待機
    if (this.activeRetries.size > 0) {
      await Promise.allSettled([...this.activeRetries]);
    }

    // 実行中のフラッシュを待機してから残りをフラッシュ
    await this.flushPromise;
    await this.flush();
    this.fastify.log.info('EventBatcher shut down');
  }

  private groupByUser(events: SessionEventJobPayload[]): Map<string, SessionEventJobPayload[]> {
    const eventsByUser = new Map<string, SessionEventJobPayload[]>();
    for (const event of events) {
      const group = eventsByUser.get(event.userId);
      if (group) {
        group.push(event);
      } else {
        eventsByUser.set(event.userId, [event]);
      }
    }
    return eventsByUser;
  }

  private async writeUserEvents(
    userId: string,
    events: SessionEventJobPayload[],
    idempotent = false
  ): Promise<void> {
    await this.fastify.withUserContext(userId, async tx => {
      for (const event of events) {
        await insertSessionEventInTx(
          tx,
          {
            uuid: event.eventUuid,
            sessionId: event.sessionId,
            type: event.type,
            subtype: event.subtype,
            message: event.message,
            createdAt: event.enqueuedAt,
          },
          idempotent ? { idempotent: true } : undefined
        );
      }
    });
  }

  private scheduleRetry(userId: string, events: SessionEventJobPayload[], attempt: number): void {
    if (this.shuttingDown) return;

    const baseDelay = Math.min(RETRY_INITIAL_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
    const delay = Math.floor(baseDelay * (0.5 + Math.random() * 0.5));

    const timer = setTimeout(() => {
      this.retryTimers.delete(timer);
      const retryPromise = this.executeRetry(userId, events, attempt);
      this.activeRetries.add(retryPromise);
      retryPromise.finally(() => {
        this.activeRetries.delete(retryPromise);
      });
    }, delay);
    timer.unref();

    this.retryTimers.add(timer);
  }

  private async executeRetry(
    userId: string,
    events: SessionEventJobPayload[],
    attempt: number
  ): Promise<void> {
    try {
      await this.writeUserEvents(userId, events, true);
      this.fastify.log.info(
        { userId, eventCount: events.length, attempt },
        'Event retry succeeded'
      );
    } catch (err) {
      if (attempt < RETRY_MAX_ATTEMPTS && !this.shuttingDown) {
        this.fastify.log.warn(
          { err, userId, eventCount: events.length, attempt, nextAttempt: attempt + 1 },
          'Event retry failed, scheduling next attempt'
        );
        this.scheduleRetry(userId, events, attempt + 1);
      } else {
        this.fastify.log.error(
          { err, userId, eventCount: events.length, attempt },
          'Event retry exhausted, events dropped'
        );
      }
    }
  }
}

/**
 * EventBatcher を初期化し、Fastify インスタンスにデコレートする
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
  fastify.eventBatcher.add({
    userId: params.userId,
    sessionId: params.sessionUUID,
    eventUuid: params.eventUuid,
    type: params.type,
    subtype: params.subtype,
    message: params.message,
  });
}
