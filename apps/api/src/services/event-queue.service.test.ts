import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      work: vi.fn().mockResolvedValue('worker-id-123'),
    };

    const mockWithUserContext = vi.fn().mockImplementation(async (_userId, callback) => {
      const mockTx = {};
      return callback(mockTx);
    });

    return {
      boss: mockBoss,
      withUserContext: mockWithUserContext,
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
    } as unknown as FastifyInstance;
  };

  describe('enqueueSessionEvent', () => {
    let fastify: FastifyInstance;

    beforeEach(() => {
      fastify = createMockFastify();
    });

    it('should enqueue event to pg-boss with correct payload', () => {
      const message = {
        type: 'system',
        subtype: 'init',
        uuid: 'event-uuid-123',
        session_id: 'sdk-session-123',
      } as unknown as SDKMessage;

      enqueueSessionEvent(fastify, {
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

    it('should use singletonKey for session ordering', () => {
      const message = {
        type: 'assistant',
        uuid: 'event-uuid-456',
        session_id: 'sdk-session-123',
      } as unknown as SDKMessage;

      enqueueSessionEvent(fastify, {
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

    it('should log error when enqueue fails', async () => {
      const error = new Error('Queue connection failed');
      (fastify.boss.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const message = {
        type: 'system',
        uuid: 'event-uuid-789',
        session_id: 'sdk-session-123',
      } as unknown as SDKMessage;

      enqueueSessionEvent(fastify, {
        userId: 'user-123',
        sessionId: 'session_01fail',
        sessionUUID: '019bdf24-b923-7aaa-918c-8ce71422def0',
        eventUuid: 'event-uuid-789',
        type: 'system',
        subtype: null,
        message,
      });

      // Wait for the promise to reject
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session_01fail',
          eventUuid: 'event-uuid-789',
        }),
        'Failed to enqueue session event'
      );
    });

    it('should handle null subtype', () => {
      const message = {
        type: 'user',
        uuid: 'event-uuid-null',
        session_id: 'sdk-session-123',
      } as unknown as SDKMessage;

      enqueueSessionEvent(fastify, {
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
    let fastify: FastifyInstance;

    beforeEach(() => {
      fastify = createMockFastify();
    });

    it('should create queue with correct settings', async () => {
      await registerEventWorker(fastify);

      expect(fastify.boss.createQueue).toHaveBeenCalledWith(SESSION_EVENTS_QUEUE, {
        retryLimit: 3,
        retryDelay: 5,
        retryBackoff: true,
        expireInSeconds: 30 * 60,
        retentionSeconds: 7 * 24 * 60 * 60,
      });
    });

    it('should register worker with correct options', async () => {
      await registerEventWorker(fastify);

      expect(fastify.boss.work).toHaveBeenCalledWith(
        SESSION_EVENTS_QUEUE,
        {
          batchSize: 1,
          pollingIntervalSeconds: 2,
        },
        expect.any(Function)
      );
    });

    it('should log queue creation', async () => {
      await registerEventWorker(fastify);

      expect(fastify.log.info).toHaveBeenCalledWith(
        { queue: SESSION_EVENTS_QUEUE },
        'Event queue created'
      );
    });

    it('should log worker registration', async () => {
      await registerEventWorker(fastify);

      expect(fastify.log.info).toHaveBeenCalledWith('Event queue worker registered');
    });
  });
});
