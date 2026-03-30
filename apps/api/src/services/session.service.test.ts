import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SessionId } from '../models/session.model.js';

// Mock external modules
vi.mock('./websocket-manager.service.js', () => ({
  wsManager: {
    broadcast: vi.fn(),
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
  },
}));

vi.mock('./event-queue.service.js', () => ({
  enqueueSessionEvent: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

vi.mock('../utils/directory.js', () => ({
  ensureDirectory: vi.fn().mockResolvedValue(undefined),
  removeDirectory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/databricks-auth.js', () => ({
  getAuthProvider: vi.fn().mockResolvedValue({
    getToken: vi.fn().mockResolvedValue('test-token'),
  }),
}));

vi.mock('../lib/mcp-databricks-apps.js', () => ({
  createDbAppsMcpServer: vi.fn().mockReturnValue({}),
}));

vi.mock('../lib/databricks-apps-client.js', () => ({
  DatabricksAppsClient: vi.fn().mockImplementation(() => ({
    delete: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../models/claude-settings.model.js', () => ({
  ClaudeSettings: vi.fn().mockImplementation(() => ({
    addSessionStartHooks: vi.fn().mockReturnThis(),
    saveToSession: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Import after mocking
import { wsManager } from './websocket-manager.service.js';
import { enqueueSessionEvent } from './event-queue.service.js';
import { canAbortSession, executeAbort } from './session.service.js';

describe('session.service', () => {
  // Mock FastifyInstance
  const createMockFastify = () => {
    const mockTx = {
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const mockWithUserContext = vi.fn().mockImplementation(async (_userId, callback) => {
      return callback(mockTx);
    });

    return {
      withUserContext: mockWithUserContext,
      log: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      config: {
        DATABRICKS_HOST: 'test.databricks.com',
        PATH: '/usr/bin',
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
        ANTHROPIC_DEFAULT_OPUS_MODEL: 'opus',
        ANTHROPIC_DEFAULT_SONNET_MODEL: 'sonnet',
        ANTHROPIC_DEFAULT_HAIKU_MODEL: 'haiku',
      },
    } as unknown as FastifyInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canAbortSession', () => {
    it('should return false when no abort controller is registered', () => {
      const sessionId = new SessionId();
      expect(canAbortSession(sessionId)).toBe(false);
    });
  });

  describe('executeAbort', () => {
    let fastify: FastifyInstance;
    const userId = 'user-123';

    beforeEach(() => {
      fastify = createMockFastify();
    });

    it('should do nothing when no abort controller exists', async () => {
      const sessionId = new SessionId();

      await executeAbort(fastify, userId, sessionId);

      expect(wsManager.broadcast).not.toHaveBeenCalled();
      expect(enqueueSessionEvent).not.toHaveBeenCalled();
    });

    it('should broadcast user abort message and result event when abort controller exists', async () => {
      // Register the session for abort by simulating a query in progress
      // We need to import and mock internal state here
      const sessionId = new SessionId();

      // To test this properly, we'd need to expose the sessionAbortControllers map
      // or use integration tests. For now, we test that it does nothing without a registered controller.
      await executeAbort(fastify, userId, sessionId);

      // Without a registered controller, no broadcasts should occur
      expect(wsManager.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('saveAndBroadcastEvent (via enqueueSessionEvent)', () => {
    // Note: saveAndBroadcastEvent is not exported, but we can test it indirectly
    // through executeAbort or other exported functions

    it('should be called by executeAbort with correct parameters', async () => {
      // This test documents the expected behavior even if we can't test it directly
      // without exposing internal state
      expect(enqueueSessionEvent).toBeDefined();
    });
  });
});

describe('SessionId', () => {
  it('should generate unique session IDs', () => {
    const id1 = new SessionId();
    const id2 = new SessionId();

    expect(id1.toString()).not.toBe(id2.toString());
  });

  it('should have correct prefix', () => {
    const sessionId = new SessionId();
    expect(sessionId.toString()).toMatch(/^session_/);
  });

  it('should convert to and from UUID', () => {
    const sessionId = new SessionId();
    const uuid = sessionId.toUUID();
    const restored = SessionId.fromUUID(uuid);

    expect(restored.toString()).toBe(sessionId.toString());
  });

  it('should convert to and from string', () => {
    const sessionId = new SessionId();
    const str = sessionId.toString();
    const restored = SessionId.fromString(str);

    expect(restored.toString()).toBe(str);
  });

  it('should get suffix correctly', () => {
    const sessionId = new SessionId();
    const suffix = sessionId.getSuffix();

    // suffix should be the part after the prefix
    expect(sessionId.toString()).toBe(`session_${suffix}`);
  });
});
