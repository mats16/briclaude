import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { listSessionEvents, getSessionLastEventId } from './session-events.service.js';
import { SessionId } from '../models/session.model.js';

// テスト用の定数（TypeID 形式と対応する UUID）
// TypeID session_01h455vb4pex5vsknk084sn02q の UUID
const TEST_SESSION_TYPEID = 'session_01h455vb4pex5vsknk084sn02q';
const TEST_SESSION_UUID = '0188a5eb-4b84-7095-bae8-084200ae0295';

// テスト用の SessionId オブジェクト
const testSessionId = SessionId.fromString(TEST_SESSION_TYPEID);

describe('session-events.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock event data
  const createMockEvent = (uuid: string, type: string) => ({
    uuid,
    type,
    subtype: null,
    message: { type, uuid },
  });

  // Helper to create chainable mock that tracks query context
  const createChainableMock = (results: {
    sessionResult: unknown[];
    afterEventResult?: unknown[];
    eventsResult: unknown[];
  }) => {
    let queryIndex = 0;

    const createChain = () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn(() => {
          queryIndex++;
          // First query: session check (returns immediately, no limit)
          if (queryIndex === 1) {
            return Promise.resolve(results.sessionResult);
          }
          // Second query with after: afterEvent lookup (returns immediately)
          if (queryIndex === 2 && results.afterEventResult) {
            return Promise.resolve(results.afterEventResult);
          }
          return chain;
        }),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn(() => {
          // Events query (with limit)
          return Promise.resolve(results.eventsResult);
        }),
      };
      return chain;
    };

    return createChain();
  };

  describe('listSessionEvents', () => {
    it('should throw error if session not found', async () => {
      const mockTx = createChainableMock({
        sessionResult: [],
        eventsResult: [],
      });

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      await expect(listSessionEvents(fastify, 'user-123', testSessionId)).rejects.toThrow(
        'Session not found'
      );
    });

    it('should return empty response for session with no events', async () => {
      const mockTx = createChainableMock({
        sessionResult: [{ id: TEST_SESSION_UUID }],
        eventsResult: [],
      });

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      const result = await listSessionEvents(fastify, 'user-123', testSessionId);

      expect(result).toEqual({
        data: [],
        first_id: '',
        last_id: '',
        has_more: false,
      });
    });

    it('should return events in response', async () => {
      const events = [createMockEvent('event-1', 'user'), createMockEvent('event-2', 'assistant')];

      const mockTx = createChainableMock({
        sessionResult: [{ id: TEST_SESSION_UUID }],
        eventsResult: events,
      });

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      const result = await listSessionEvents(fastify, 'user-123', testSessionId);

      expect(result.data).toHaveLength(2);
      expect(result.first_id).toBe('event-1');
      expect(result.last_id).toBe('event-2');
    });

    it('should respect limit parameter', async () => {
      let capturedLimit = 0;

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          let queryIndex = 0;
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn(() => {
              queryIndex++;
              if (queryIndex === 1) {
                return Promise.resolve([{ id: TEST_SESSION_UUID }]);
              }
              return mockTx;
            }),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn((limit: number) => {
              capturedLimit = limit;
              return Promise.resolve([]);
            }),
          };
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      await listSessionEvents(fastify, 'user-123', testSessionId, { limit: 2 });

      // Limit should be 3 (2 + 1 for has_more check)
      expect(capturedLimit).toBe(3);
    });

    it('should cap limit at 1000', async () => {
      let capturedLimit = 0;

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          let queryIndex = 0;
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn(() => {
              queryIndex++;
              if (queryIndex === 1) {
                return Promise.resolve([{ id: TEST_SESSION_UUID }]);
              }
              return mockTx;
            }),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn((limit: number) => {
              capturedLimit = limit;
              return Promise.resolve([]);
            }),
          };
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      await listSessionEvents(fastify, 'user-123', testSessionId, { limit: 2000 });

      // Limit should be capped at 1001 (1000 + 1 for has_more check)
      expect(capturedLimit).toBe(1001);
    });

    it('should set has_more when more events exist', async () => {
      // Return 3 events when limit is 2 (limit+1 triggers has_more)
      const events = [
        createMockEvent('event-1', 'user'),
        createMockEvent('event-2', 'assistant'),
        createMockEvent('event-3', 'user'),
      ];

      const mockTx = createChainableMock({
        sessionResult: [{ id: TEST_SESSION_UUID }],
        eventsResult: events,
      });

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      const result = await listSessionEvents(fastify, 'user-123', testSessionId, { limit: 2 });

      expect(result.has_more).toBe(true);
      expect(result.data.length).toBe(2);
    });

    it('should return first_id and last_id correctly', async () => {
      const events = [
        createMockEvent('first-event', 'user'),
        createMockEvent('middle-event', 'assistant'),
        createMockEvent('last-event', 'user'),
      ];

      const mockTx = createChainableMock({
        sessionResult: [{ id: TEST_SESSION_UUID }],
        eventsResult: events,
      });

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      const result = await listSessionEvents(fastify, 'user-123', testSessionId);

      expect(result.first_id).toBe('first-event');
      expect(result.last_id).toBe('last-event');
    });

    it('should handle after parameter for pagination', async () => {
      const mockTx = createChainableMock({
        sessionResult: [{ id: TEST_SESSION_UUID }],
        afterEventResult: [{ createdAt: new Date('2024-01-01T10:00:00Z') }],
        eventsResult: [createMockEvent('event-after', 'user')],
      });

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      const result = await listSessionEvents(fastify, 'user-123', testSessionId, {
        after: 'event-before',
      });

      expect(result.data).toHaveLength(1);
    });

    it('should handle minimum limit of 1', async () => {
      let capturedLimit = 0;

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          let queryIndex = 0;
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn(() => {
              queryIndex++;
              if (queryIndex === 1) {
                return Promise.resolve([{ id: TEST_SESSION_UUID }]);
              }
              return mockTx;
            }),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn((limit: number) => {
              capturedLimit = limit;
              return Promise.resolve([]);
            }),
          };
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      await listSessionEvents(fastify, 'user-123', testSessionId, { limit: 0 });

      // Limit should be at least 2 (1 + 1 for has_more)
      expect(capturedLimit).toBe(2);
    });
  });

  describe('getSessionLastEventId', () => {
    it('should throw error if session not found', async () => {
      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([]), // Empty = session not found
          };
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      await expect(getSessionLastEventId(fastify, 'user-123', testSessionId)).rejects.toThrow(
        'Session not found'
      );
    });

    it('should return null when no events exist', async () => {
      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          let queryIndex = 0;
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn(() => {
              queryIndex++;
              if (queryIndex === 1) {
                return Promise.resolve([{ id: TEST_SESSION_UUID }]);
              }
              return mockTx;
            }),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      const result = await getSessionLastEventId(fastify, 'user-123', testSessionId);

      expect(result).toBeNull();
    });

    it('should return latest event uuid', async () => {
      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          let queryIndex = 0;
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn(() => {
              queryIndex++;
              if (queryIndex === 1) {
                return Promise.resolve([{ id: TEST_SESSION_UUID }]);
              }
              return mockTx;
            }),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ uuid: 'latest-event-uuid' }]),
          };
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      const result = await getSessionLastEventId(fastify, 'user-123', testSessionId);

      expect(result).toBe('latest-event-uuid');
    });

    it('should query events in descending order by created_at', async () => {
      let orderByCalled = false;

      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          let queryIndex = 0;
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn(() => {
              queryIndex++;
              if (queryIndex === 1) {
                return Promise.resolve([{ id: TEST_SESSION_UUID }]);
              }
              return mockTx;
            }),
            orderBy: vi.fn(() => {
              orderByCalled = true;
              return mockTx;
            }),
            limit: vi.fn().mockResolvedValue([{ uuid: 'event-uuid' }]),
          };
          return callback(mockTx);
        }
      );

      const fastify = {
        withUserContext: mockWithUserContext,
      } as unknown as FastifyInstance;

      await getSessionLastEventId(fastify, 'user-123', testSessionId);

      expect(orderByCalled).toBe(true);
    });
  });
});
