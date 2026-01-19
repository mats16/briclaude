import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import configPlugin from '../plugins/config.js';
import requestDecoratorPlugin from '../plugins/request-decorator.js';
import sessionRoute from './session.js';
import { SessionId } from '../models/session.model.js';

// Mock session service
vi.mock('../services/session.service.js', () => ({
  createSession: vi.fn(),
  listSessions: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  archiveSession: vi.fn(),
  sendMessageToSession: vi.fn(),
}));

// Mock session-events service
vi.mock('../services/session-events.service.js', () => ({
  listSessionEvents: vi.fn(),
  getSessionLastEventId: vi.fn(),
}));

// Mock websocket manager
vi.mock('../services/websocket-manager.service.js', () => ({
  wsManager: {
    addConnection: vi.fn(),
    removeConnection: vi.fn(),
  },
}));

// Mock UserContext
vi.mock('../lib/user-context.js', () => ({
  createUserContext: vi.fn(() => ({
    userId: 'test-user',
    userHome: '/home/test-user',
    getAuthProvider: vi.fn().mockResolvedValue({
      type: 'pat',
      getEnvVars: vi.fn(),
      getToken: vi.fn().mockResolvedValue('test-pat-token'),
    }),
    oboAccessToken: undefined,
  })),
}));

// Test user headers for authentication
const TEST_USER_HEADERS = {
  'x-forwarded-user': 'test-user-id',
  'x-forwarded-preferred-username': 'Test User',
  'x-forwarded-email': 'test@example.com',
};

describe('session route - invalid session ID handling', () => {
  let app: FastifyInstance;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };

    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.DATABRICKS_HOST = 'test.databricks.com';
    process.env.NODE_ENV = 'test';

    app = Fastify({
      logger: false,
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await app.close();
  });

  async function registerPlugins() {
    await app.register(configPlugin);
    await app.register(requestDecoratorPlugin);
    await app.register(sessionRoute, { prefix: '/api' });
  }

  describe('GET /sessions/:session_id', () => {
    it('should return 404 for completely invalid session ID format', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/aaaaa',
        headers: TEST_USER_HEADERS,
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NotFound');
      expect(body.message).toBe('Session not found');
    });

    it('should return 404 for wrong TypeID prefix', async () => {
      await registerPlugins();

      // Use a valid TypeID format but with wrong prefix
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/user_01h455vb4pex5vsknk084sn02q',
        headers: TEST_USER_HEADERS,
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NotFound');
      expect(body.message).toBe('Session not found');
    });

    it('should return 404 for empty session ID', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/',
        headers: TEST_USER_HEADERS,
      });

      // Empty path segment results in 404 route not found
      expect(response.statusCode).toBe(404);
    });

    it('should accept valid session TypeID format', async () => {
      const { getSession } = await import('../services/session.service.js');
      const mockGetSession = vi.mocked(getSession);
      mockGetSession.mockResolvedValue(null); // Session doesn't exist in DB

      await registerPlugins();

      const validSessionId = new SessionId().toString();
      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${validSessionId}`,
        headers: TEST_USER_HEADERS,
      });

      // Should return 404 because session doesn't exist (not because ID is invalid)
      expect(response.statusCode).toBe(404);
      expect(mockGetSession).toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/aaaaa',
        // No headers = no user
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('Unauthorized');
    });
  });

  describe('PATCH /sessions/:session_id', () => {
    it('should return 404 for invalid session ID format', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'PATCH',
        url: '/api/sessions/invalid-id',
        headers: TEST_USER_HEADERS,
        payload: { title: 'New Title' },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NotFound');
      expect(body.message).toBe('Session not found');
    });
  });

  describe('POST /sessions/:session_id/archive', () => {
    it('should return 404 for invalid session ID format', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/sessions/not-a-valid-id/archive',
        headers: TEST_USER_HEADERS,
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NotFound');
      expect(body.message).toBe('Session not found');
    });
  });

  describe('GET /sessions/:session_id/events', () => {
    it('should return 404 for invalid session ID format', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/random-string/events',
        headers: TEST_USER_HEADERS,
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NotFound');
      expect(body.message).toBe('Session not found');
    });

    it('should return 404 for special characters in session ID', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/session_!@%23$%25/events',
        headers: TEST_USER_HEADERS,
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NotFound');
    });
  });
});
