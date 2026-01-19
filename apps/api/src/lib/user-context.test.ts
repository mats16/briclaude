import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { UserContext, createUserContext } from './user-context.js';

// Mock databricks-auth
vi.mock('../utils/databricks-auth.js', () => ({
  getUserPAT: vi.fn(),
  getServicePrincipalTokenFromConfig: vi.fn(),
}));

import { getUserPAT, getServicePrincipalTokenFromConfig } from '../utils/databricks-auth.js';

const mockGetUserPAT = getUserPAT as ReturnType<typeof vi.fn>;
const mockGetServicePrincipalTokenFromConfig = getServicePrincipalTokenFromConfig as ReturnType<typeof vi.fn>;

describe('UserContext', () => {
  const createMockFastify = (): FastifyInstance => {
    return {
      config: {
        USER_BASE_DIR: '/home/app/users',
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

  describe('getPat', () => {
    it('should fetch PAT from database and cache it', async () => {
      mockGetUserPAT.mockResolvedValue('user-pat-token');
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);

      // First call - fetches from DB
      const pat1 = await ctx.getPat();
      expect(pat1).toBe('user-pat-token');
      expect(mockGetUserPAT).toHaveBeenCalledTimes(1);
      expect(mockGetUserPAT).toHaveBeenCalledWith(fastify, 'test-user@example.com');

      // Second call - should use cache
      const pat2 = await ctx.getPat();
      expect(pat2).toBe('user-pat-token');
      expect(mockGetUserPAT).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should cache undefined result', async () => {
      mockGetUserPAT.mockResolvedValue(undefined);
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);

      // First call
      const pat1 = await ctx.getPat();
      expect(pat1).toBeUndefined();
      expect(mockGetUserPAT).toHaveBeenCalledTimes(1);

      // Second call - should still use cached undefined
      const pat2 = await ctx.getPat();
      expect(pat2).toBeUndefined();
      expect(mockGetUserPAT).toHaveBeenCalledTimes(1);
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

  describe('getSpAccessToken', () => {
    it('should fetch SP token directly (no request-scope caching)', async () => {
      mockGetServicePrincipalTokenFromConfig.mockResolvedValue('sp-token-123');
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);

      // First call
      const token1 = await ctx.getSpAccessToken();
      expect(token1).toBe('sp-token-123');
      expect(mockGetServicePrincipalTokenFromConfig).toHaveBeenCalledTimes(1);

      // Second call - should call service again (no request-scope caching)
      const token2 = await ctx.getSpAccessToken();
      expect(token2).toBe('sp-token-123');
      expect(mockGetServicePrincipalTokenFromConfig).toHaveBeenCalledTimes(2);
    });

    it('should return undefined when SP token is not available', async () => {
      mockGetServicePrincipalTokenFromConfig.mockResolvedValue(undefined);
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);
      const token = await ctx.getSpAccessToken();

      expect(token).toBeUndefined();
    });
  });

  describe('getAccessToken', () => {
    it('should return PAT when available', async () => {
      mockGetUserPAT.mockResolvedValue('pat-token');
      mockGetServicePrincipalTokenFromConfig.mockResolvedValue('sp-token');
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);
      const token = await ctx.getAccessToken();

      expect(token).toBe('pat-token');
      expect(mockGetUserPAT).toHaveBeenCalled();
      // SP token should not be fetched since PAT is available
      expect(mockGetServicePrincipalTokenFromConfig).not.toHaveBeenCalled();
    });

    it('should fallback to SP token when PAT is undefined', async () => {
      mockGetUserPAT.mockResolvedValue(undefined);
      mockGetServicePrincipalTokenFromConfig.mockResolvedValue('sp-token');
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);
      const token = await ctx.getAccessToken();

      expect(token).toBe('sp-token');
      expect(mockGetUserPAT).toHaveBeenCalled();
      expect(mockGetServicePrincipalTokenFromConfig).toHaveBeenCalled();
    });

    it('should return undefined when both PAT and SP are unavailable', async () => {
      mockGetUserPAT.mockResolvedValue(undefined);
      mockGetServicePrincipalTokenFromConfig.mockResolvedValue(undefined);
      const fastify = createMockFastify();
      const request = createMockRequest();

      const ctx = new UserContext(fastify, request);
      const token = await ctx.getAccessToken();

      expect(token).toBeUndefined();
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
