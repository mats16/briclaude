import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { EventBatcher, enqueueSessionEvent } from './event-queue.service.js';

// insertSessionEventInTx をモック
vi.mock('../db/helpers.js', () => ({
  insertSessionEventInTx: vi.fn().mockResolvedValue({ uuid: 'inserted' }),
}));

import { insertSessionEventInTx } from '../db/helpers.js';

const createMockFastify = () => {
  const mockWithUserContext = vi.fn().mockImplementation(async (_userId, callback) => {
    const mockTx = {};
    return callback(mockTx);
  });

  return {
    withUserContext: mockWithUserContext,
    log: {
      info: vi.fn(),
      error: vi.fn(),
    },
    config: {
      EVENT_PERSIST_BATCH_SIZE: 10,
      EVENT_PERSIST_INTERVAL: 5.0,
    },
    eventBatcher: null as unknown as EventBatcher,
  } as unknown as FastifyInstance;
};

const createPayload = (overrides = {}) => ({
  userId: 'user-123',
  sessionId: '019bdf24-b923-7aaa-918c-8ce71422def0',
  eventUuid: `event-${Math.random().toString(36).slice(2)}`,
  type: 'system',
  subtype: 'init' as string | null,
  message: { type: 'system', subtype: 'init' } as unknown as SDKMessage,
  ...overrides,
});

describe('EventBatcher', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    fastify = createMockFastify();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should log on start', () => {
    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.start();

    expect(fastify.log.info).toHaveBeenCalledWith(
      { batchSize: 10, intervalMs: 5000 },
      'EventBatcher started'
    );
  });

  it('should add events to buffer', () => {
    const batcher = new EventBatcher(fastify, 10, 5000);
    const payload = createPayload();

    batcher.add(payload);

    // バッファに追加されたことを間接的にテスト（flush で確認）
    expect(insertSessionEventInTx).not.toHaveBeenCalled();
  });

  it('should flush events to DB', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);
    const payload = createPayload();

    batcher.add(payload);
    await batcher.flush();

    expect(fastify.withUserContext).toHaveBeenCalledWith('user-123', expect.any(Function));
    expect(insertSessionEventInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        uuid: payload.eventUuid,
        sessionId: payload.sessionId,
        type: 'system',
        subtype: 'init',
      })
    );
  });

  it('should clear buffer after flush', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.add(createPayload());
    await batcher.flush();

    vi.clearAllMocks();

    // 2回目の flush は no-op（バッファ空）
    await batcher.flush();
    expect(insertSessionEventInTx).not.toHaveBeenCalled();
  });

  it('should be no-op when buffer is empty', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);

    await batcher.flush();

    expect(fastify.withUserContext).not.toHaveBeenCalled();
  });

  it('should trigger flush when batch size is reached', async () => {
    const batcher = new EventBatcher(fastify, 3, 5000);

    batcher.add(createPayload());
    batcher.add(createPayload());

    // まだ flush されていない
    expect(insertSessionEventInTx).not.toHaveBeenCalled();

    // 3件目で flush がトリガーされる
    batcher.add(createPayload());

    // flush は非同期なので await する
    await vi.runAllTimersAsync();

    expect(insertSessionEventInTx).toHaveBeenCalledTimes(3);
  });

  it('should group events by userId into single transaction', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);

    batcher.add(createPayload({ userId: 'user-1' }));
    batcher.add(createPayload({ userId: 'user-1' }));
    batcher.add(createPayload({ userId: 'user-2' }));

    await batcher.flush();

    // user-1 は1トランザクション、user-2 は1トランザクション
    expect(fastify.withUserContext).toHaveBeenCalledTimes(2);
    expect(insertSessionEventInTx).toHaveBeenCalledTimes(3);
  });

  it('should flush different users in parallel', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);

    batcher.add(createPayload({ userId: 'user-1' }));
    batcher.add(createPayload({ userId: 'user-2' }));
    batcher.add(createPayload({ userId: 'user-3' }));

    await batcher.flush();

    expect(fastify.withUserContext).toHaveBeenCalledTimes(3);
  });

  it('should log errors for failed events without throwing', async () => {
    const error = new Error('DB insert failed');
    (insertSessionEventInTx as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.add(createPayload());
    batcher.add(createPayload());

    // 例外を投げない
    await batcher.flush();

    expect(fastify.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ failureCount: 1, batchSize: 2, lostEventCount: 2 }),
      'Some events failed to persist'
    );
  });

  it('should flush on interval timer', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.start();

    batcher.add(createPayload());

    // 5秒経過でタイマーが発火
    await vi.advanceTimersByTimeAsync(5000);

    expect(insertSessionEventInTx).toHaveBeenCalledTimes(1);
  });

  it('should shutdown: clear timer and flush remaining', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.start();

    batcher.add(createPayload());
    batcher.add(createPayload());

    await batcher.shutdown();

    expect(insertSessionEventInTx).toHaveBeenCalledTimes(2);
    expect(fastify.log.info).toHaveBeenCalledWith('EventBatcher shut down');
  });
});

describe('enqueueSessionEvent', () => {
  it('should call eventBatcher.add with correct payload', () => {
    const mockAdd = vi.fn();
    const fastify = {
      eventBatcher: { add: mockAdd },
    } as unknown as FastifyInstance;

    const message = {
      type: 'assistant',
      uuid: 'msg-uuid',
    } as unknown as SDKMessage;

    enqueueSessionEvent(fastify, {
      userId: 'user-123',
      sessionId: 'session_01abc123',
      sessionUUID: '019bdf24-b923-7aaa-918c-8ce71422def0',
      eventUuid: 'event-uuid-123',
      type: 'assistant',
      subtype: null,
      message,
    });

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        sessionId: '019bdf24-b923-7aaa-918c-8ce71422def0',
        eventUuid: 'event-uuid-123',
        type: 'assistant',
        subtype: null,
        message,
      })
    );
  });

  it('should use sessionUUID (not sessionId) for DB payload', () => {
    const mockAdd = vi.fn();
    const fastify = {
      eventBatcher: { add: mockAdd },
    } as unknown as FastifyInstance;

    enqueueSessionEvent(fastify, {
      userId: 'user-123',
      sessionId: 'session_01xyz',
      sessionUUID: 'uuid-for-db',
      eventUuid: 'event-1',
      type: 'user',
      subtype: null,
      message: {} as SDKMessage,
    });

    const payload = mockAdd.mock.calls[0][0];
    expect(payload.sessionId).toBe('uuid-for-db');
  });
});
