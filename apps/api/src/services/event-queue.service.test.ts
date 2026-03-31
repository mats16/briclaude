import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { SessionEventJobPayload } from '../types/event-queue.types.js';
import { EventBatcher, enqueueSessionEvent } from './event-queue.service.js';

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
      warn: vi.fn(),
      error: vi.fn(),
    },
    config: {
      EVENT_PERSIST_BATCH_SIZE: 10,
      EVENT_PERSIST_INTERVAL: 5.0,
    },
    eventBatcher: null as unknown as EventBatcher,
  } as unknown as FastifyInstance;
};

const createPayload = (
  overrides: Partial<SessionEventJobPayload> = {}
): SessionEventJobPayload => ({
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

    expect(insertSessionEventInTx).not.toHaveBeenCalled();
  });

  it('should not mutate the input payload', () => {
    const batcher = new EventBatcher(fastify, 10, 5000);
    const payload = createPayload();
    batcher.add(payload);
    expect(payload.enqueuedAt).toBeUndefined();
  });

  it('should flush events to DB with createdAt from enqueuedAt', async () => {
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
        createdAt: expect.any(Date),
      }),
      undefined
    );
  });

  it('should clear buffer after flush', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.add(createPayload());
    await batcher.flush();

    vi.clearAllMocks();

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

    expect(insertSessionEventInTx).not.toHaveBeenCalled();

    batcher.add(createPayload());

    await vi.runAllTimersAsync();

    expect(insertSessionEventInTx).toHaveBeenCalledTimes(3);
  });

  it('should group events by userId into single transaction', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);

    batcher.add(createPayload({ userId: 'user-1' }));
    batcher.add(createPayload({ userId: 'user-1' }));
    batcher.add(createPayload({ userId: 'user-2' }));

    await batcher.flush();

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

  it('should schedule retry on flush failure instead of dropping events', async () => {
    const error = new Error('DB insert failed');
    (insertSessionEventInTx as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.add(createPayload());
    batcher.add(createPayload());

    await batcher.flush();

    expect(fastify.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123', eventCount: 2 }),
      'Event flush failed for user, scheduling retry'
    );
  });

  it('should retry with exponential backoff and succeed', async () => {
    const error = new Error('DB insert failed');
    (insertSessionEventInTx as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.add(createPayload());

    await batcher.flush();

    // 500ms 後にリトライ
    await vi.advanceTimersByTimeAsync(500);

    // リトライは idempotent オプション付きで呼ばれる
    expect(insertSessionEventInTx).toHaveBeenLastCalledWith(expect.anything(), expect.anything(), {
      idempotent: true,
    });
    expect(fastify.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123', eventCount: 1, attempt: 1 }),
      'Event retry succeeded'
    );
  });

  it('should increase retry delay exponentially', async () => {
    (insertSessionEventInTx as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail again'));

    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.add(createPayload());

    await batcher.flush();

    // 1回目のリトライ: 500ms
    await vi.advanceTimersByTimeAsync(500);
    expect(fastify.log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, nextAttempt: 2 }),
      'Event retry failed, scheduling next attempt'
    );

    // 2回目のリトライ: 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(insertSessionEventInTx).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('should drop events after max retry attempts', async () => {
    (insertSessionEventInTx as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('persistent failure')
    );

    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.add(createPayload());

    await batcher.flush();

    // 5回のリトライ: 500 + 1000 + 2000 + 4000 + 8000
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(8000);

    expect(fastify.log.error).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 5 }),
      'Event retry exhausted, events dropped'
    );
  });

  it('should flush on interval timer', async () => {
    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.start();

    batcher.add(createPayload());

    await vi.advanceTimersByTimeAsync(5000);

    expect(insertSessionEventInTx).toHaveBeenCalledTimes(1);
  });

  it('should shutdown: clear timer, cancel retries, and flush remaining', async () => {
    (insertSessionEventInTx as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));

    const batcher = new EventBatcher(fastify, 10, 5000);
    batcher.start();

    batcher.add(createPayload());
    await batcher.flush();

    vi.clearAllMocks();
    (insertSessionEventInTx as ReturnType<typeof vi.fn>).mockResolvedValue({ uuid: 'inserted' });
    batcher.add(createPayload());

    await batcher.shutdown();

    expect(insertSessionEventInTx).toHaveBeenCalled();
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
