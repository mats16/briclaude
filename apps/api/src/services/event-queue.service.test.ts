import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { enqueueSessionEvent, registerEventWorker } from './event-queue.service.js';
import { SESSION_EVENTS_QUEUE } from '../types/event-queue.types.js';

describe('event-queue.service', () => {
  // Mock FastifyInstance
  const createMockFastify = () => {
    const mockBoss = {
      send: vi.fn().mockResolvedValue('job-id-123'),
      createQueue: vi.fn().mockResolvedValue(undefined),
      fetch: vi.fn().mockResolvedValue([]),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
    };

    const mockWithUserContext = vi.fn().mockImplementation(async (_userId, callback) => {
      const mockTx = {};
      return callback(mockTx);
    });

    return {
      boss: mockBoss,
      withUserContext: mockWithUserContext,
      isBossShuttingDown: false,
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
      config: {
        PGBOSS_RETRY_LIMIT: 3,
        PGBOSS_RETRY_DELAY: 5,
        PGBOSS_EXPIRE_IN_SECONDS: 1800,
        PGBOSS_RETENTION_SECONDS: 604800,
        PGBOSS_BATCH_SIZE: 10,
        PGBOSS_POLLING_INTERVAL_SECONDS: 2,
      },
    } as unknown as FastifyInstance;
  };

  describe('enqueueSessionEvent', () => {
    let fastify: FastifyInstance;

    beforeEach(() => {
      fastify = createMockFastify();
    });

    it('should enqueue event to pg-boss with correct payload', async () => {
      const message = {
        type: 'system',
        subtype: 'init',
        uuid: 'event-uuid-123',
        session_id: 'sdk-session-123',
      } as unknown as SDKMessage;

      await enqueueSessionEvent(fastify, {
        userId: 'user-123',
        sessionId: 'session_01abc123',
        sessionUUID: '019bdf24-b923-7aaa-918c-8ce71422def0',
        eventUuid: 'event-uuid-123',
        type: 'system',
        subtype: 'init',
        message,
      });

      expect(fastify.boss.send).toHaveBeenCalledWith(
        SESSION_EVENTS_QUEUE,
        expect.objectContaining({
          userId: 'user-123',
          sessionId: '019bdf24-b923-7aaa-918c-8ce71422def0',
          eventUuid: 'event-uuid-123',
          type: 'system',
          subtype: 'init',
          message,
        }),
        { singletonKey: 'session_01abc123' }
      );
    });

    it('should use singletonKey for session ordering', async () => {
      const message = {
        type: 'assistant',
        uuid: 'event-uuid-456',
        session_id: 'sdk-session-123',
      } as unknown as SDKMessage;

      await enqueueSessionEvent(fastify, {
        userId: 'user-123',
        sessionId: 'session_01xyz789',
        sessionUUID: '019bdf24-b923-7aaa-918c-8ce71422def0',
        eventUuid: 'event-uuid-456',
        type: 'assistant',
        subtype: null,
        message,
      });

      expect(fastify.boss.send).toHaveBeenCalledWith(SESSION_EVENTS_QUEUE, expect.anything(), {
        singletonKey: 'session_01xyz789',
      });
    });

    it('should throw error and log when enqueue fails', async () => {
      const error = new Error('Queue connection failed');
      (fastify.boss.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const message = {
        type: 'system',
        uuid: 'event-uuid-789',
        session_id: 'sdk-session-123',
      } as unknown as SDKMessage;

      await expect(
        enqueueSessionEvent(fastify, {
          userId: 'user-123',
          sessionId: 'session_01fail',
          sessionUUID: '019bdf24-b923-7aaa-918c-8ce71422def0',
          eventUuid: 'event-uuid-789',
          type: 'system',
          subtype: null,
          message,
        })
      ).rejects.toThrow('Queue connection failed');

      expect(fastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session_01fail',
          eventUuid: 'event-uuid-789',
        }),
        'Failed to enqueue session event'
      );
    });

    it('should handle null subtype', async () => {
      const message = {
        type: 'user',
        uuid: 'event-uuid-null',
        session_id: 'sdk-session-123',
      } as unknown as SDKMessage;

      await enqueueSessionEvent(fastify, {
        userId: 'user-123',
        sessionId: 'session_01null',
        sessionUUID: '019bdf24-b923-7aaa-918c-8ce71422def0',
        eventUuid: 'event-uuid-null',
        type: 'user',
        subtype: null,
        message,
      });

      expect(fastify.boss.send).toHaveBeenCalledWith(
        SESSION_EVENTS_QUEUE,
        expect.objectContaining({
          subtype: null,
        }),
        expect.anything()
      );
    });
  });

  describe('registerEventWorker', () => {
    let fastify: ReturnType<typeof createMockFastify>;

    beforeEach(() => {
      fastify = createMockFastify();
    });

    afterEach(() => {
      // ポーリングループを停止
      fastify.isBossShuttingDown = true;
    });

    it('should create queue with config settings', async () => {
      await registerEventWorker(fastify as unknown as FastifyInstance);

      expect(fastify.boss.createQueue).toHaveBeenCalledWith(SESSION_EVENTS_QUEUE, {
        retryLimit: 3,
        retryDelay: 5,
        retryBackoff: true,
        expireInSeconds: 1800,
        retentionSeconds: 604800,
      });
    });

    it('should use custom config values when provided', async () => {
      const customFastify = {
        ...createMockFastify(),
        config: {
          PGBOSS_RETRY_LIMIT: 5,
          PGBOSS_RETRY_DELAY: 10,
          PGBOSS_EXPIRE_IN_SECONDS: 3600,
          PGBOSS_RETENTION_SECONDS: 86400,
          PGBOSS_BATCH_SIZE: 20,
          PGBOSS_POLLING_INTERVAL_SECONDS: 5,
        },
      };

      await registerEventWorker(customFastify as unknown as FastifyInstance);
      customFastify.isBossShuttingDown = true;

      expect(customFastify.boss.createQueue).toHaveBeenCalledWith(SESSION_EVENTS_QUEUE, {
        retryLimit: 5,
        retryDelay: 10,
        retryBackoff: true,
        expireInSeconds: 3600,
        retentionSeconds: 86400,
      });
    });

    it('should log queue creation', async () => {
      await registerEventWorker(fastify as unknown as FastifyInstance);

      expect(fastify.log.info).toHaveBeenCalledWith(
        { queue: SESSION_EVENTS_QUEUE },
        'Event queue created'
      );
    });

    it('should log worker registration', async () => {
      await registerEventWorker(fastify as unknown as FastifyInstance);

      expect(fastify.log.info).toHaveBeenCalledWith('Event queue worker registered');
    });

    it('should start polling loop that fetches jobs', async () => {
      await registerEventWorker(fastify as unknown as FastifyInstance);

      // ポーリングループが開始されるまで少し待つ
      await new Promise(resolve => setTimeout(resolve, 50));

      // fetch が呼び出されていることを確認
      expect(fastify.boss.fetch).toHaveBeenCalledWith(SESSION_EVENTS_QUEUE, {
        batchSize: 10,
      });
    });
  });
});
