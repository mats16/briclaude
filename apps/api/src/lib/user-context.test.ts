import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { UserContext, createUserContext } from './user-context.js';

// Mock databricks-auth
vi.mock('./databricks-auth.js', () => ({
  getAuthProvider: vi.fn(),
}));

import { getAuthProvider } from './databricks-auth.js';

const mockGetAuthProvider = getAuthProvider as ReturnType<typeof vi.fn>;

describe('UserContext', () => {
  const createMockFastify = (): FastifyInstance => {
    return {
      config: {
        USER_BASE_DIR: '/home/app/users',
        DATABRICKS_HOST: 'example.databricks.com',
        DATABRICKS_CLIENT_ID: 'test-client-id',
        DATABRICKS_CLIENT_SECRET: 'test-client-secret',
      },
      log: {
        error: vi.fn(),
      },
    } as unknown as FastifyInstance;
  };

  const createMockRequest = (
    userOverrides: Partial<{
      id: string;
      name: string;
      email: string;
      oboAccessToken: string;
    }> = {}
  ): FastifyRequest => {
    return {
      ctx: {
        user: {
          id: 'test-user@example.com',
          name: 'Test User',
          email: 'test-user@example.com',
          oboAccessToken: undefined,
          ...userOverrides,
        },
      },
    } as unknown as FastifyRequest;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct userId and userHome', () => {
      const fastify = createMockFastify();
      const request = createMockRequest({ id: 'user@example.com' });

      const ctx = new UserContext(fastify, request);

      expect(ctx.userId).toBe('user@example.com');
      expect(ctx.userHome).toBe('/home/app/users/user');
    });

    it('should handle userId without @ symbol', () => {
      const fastify = createMockFastify();
      const request = createMockRequest({ id: 'simpleuser' });

      const ctx = new UserContext(fastify, request);

      expect(ctx.userId).toBe('simpleuser');
      expect(ctx.userHome).toBe('/home/app/users/simpleuser');
    });

    it('should throw error when user context is not available', () => {
      const fastify = createMockFastify();
      const request = { ctx: null } as unknown as FastifyRequest;

      expect(() => new UserContext(fastify, request)).toThrow('User context is not available');
    });

    it('should throw error when user is undefined', () => {
      const fastify = createMockFastify();
      const request = { ctx: {} } as unknown as FastifyRequest;

      expect(() => new UserContext(fastify, request)).toThrow('User context is not available');
    });
  });

  describe('getAuthProvider', () => {
    it('should fetch AuthProvider and cache it', async () => {
      const mockAuthProvider = {
        type: 'pat' as const,
        getEnvVars: vi.fn(),
        getToken: vi.fn().mockResolvedValue('user-pat-token'),
      };
      mockGetAuthProvider.mockResolvedValue(mockAuthProvider);
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);

      // First call - fetches AuthProvider
      const provider1 = await ctx.getAuthProvider();
      expect(provider1).toBe(mockAuthProvider);
      expect(mockGetAuthProvider).toHaveBeenCalledTimes(1);
      expect(mockGetAuthProvider).toHaveBeenCalledWith(fastify, 'test-user@example.com');

      // Second call - should use cache
      const provider2 = await ctx.getAuthProvider();
      expect(provider2).toBe(mockAuthProvider);
      expect(mockGetAuthProvider).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should return PAT type AuthProvider when PAT is available', async () => {
      const mockAuthProvider = {
        type: 'pat' as const,
        getEnvVars: vi.fn(),
        getToken: vi.fn().mockResolvedValue('user-pat-token'),
      };
      mockGetAuthProvider.mockResolvedValue(mockAuthProvider);
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);
      const provider = await ctx.getAuthProvider();

      expect(provider.type).toBe('pat');
      const token = await provider.getToken();
      expect(token).toBe('user-pat-token');
    });

    it('should return oauth-m2m type AuthProvider when PAT is not available', async () => {
      const mockAuthProvider = {
        type: 'oauth-m2m' as const,
        getEnvVars: vi.fn(),
        getToken: vi.fn().mockResolvedValue('sp-token'),
      };
      mockGetAuthProvider.mockResolvedValue(mockAuthProvider);
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);
      const provider = await ctx.getAuthProvider();

      expect(provider.type).toBe('oauth-m2m');
      const token = await provider.getToken();
      expect(token).toBe('sp-token');
    });
  });

  describe('oboAccessToken', () => {
    it('should return OBO token from request context', () => {
      const fastify = createMockFastify();
      const request = createMockRequest({ oboAccessToken: 'obo-token-123' });

      const ctx = new UserContext(fastify, request);

      expect(ctx.oboAccessToken).toBe('obo-token-123');
    });

    it('should return undefined when OBO token is empty string', () => {
      const fastify = createMockFastify();
      const request = createMockRequest({ oboAccessToken: '' });

      const ctx = new UserContext(fastify, request);

      expect(ctx.oboAccessToken).toBeUndefined();
    });

    it('should return undefined when OBO token is not set', () => {
      const fastify = createMockFastify();
      const request = createMockRequest({ oboAccessToken: undefined });

      const ctx = new UserContext(fastify, request);

      expect(ctx.oboAccessToken).toBeUndefined();
    });
  });

  describe('createUserContext', () => {
    it('should create a new UserContext instance', () => {
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = createUserContext(fastify, request);

      expect(ctx).toBeInstanceOf(UserContext);
      expect(ctx.userId).toBe('test-user@example.com');
    });
  });
});
