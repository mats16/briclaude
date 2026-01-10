import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  getServicePrincipalToken,
  getUserPAT,
  clearTokenCache,
} from './token-resolver.service.js';

describe('token-resolver.service', () => {
  // Mock Fastify instance
  const createMockFastify = (
    configOverrides: Partial<{
      DATABRICKS_HOST: string;
      DATABRICKS_CLIENT_ID: string;
      DATABRICKS_CLIENT_SECRET: string;
    }> = {}
  ): FastifyInstance => {
    return {
      config: {
        DATABRICKS_HOST: 'test.databricks.com',
        DATABRICKS_CLIENT_ID: '',
        DATABRICKS_CLIENT_SECRET: '',
        ...configOverrides,
      },
      log: {
        error: vi.fn(),
        warn: vi.fn(),
      },
      withUserContext: vi.fn(),
    } as unknown as FastifyInstance;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearTokenCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getServicePrincipalToken', () => {
    it('should return undefined when no SP credentials configured', async () => {
      const fastify = createMockFastify({
        DATABRICKS_CLIENT_ID: '',
        DATABRICKS_CLIENT_SECRET: '',
      });

      const token = await getServicePrincipalToken(fastify);

      expect(token).toBeUndefined();
    });

    it('should return undefined when client ID is missing', async () => {
      const fastify = createMockFastify({
        DATABRICKS_CLIENT_ID: '',
        DATABRICKS_CLIENT_SECRET: 'secret',
      });

      const token = await getServicePrincipalToken(fastify);

      expect(token).toBeUndefined();
    });

    it('should return undefined when client secret is missing', async () => {
      const fastify = createMockFastify({
        DATABRICKS_CLIENT_ID: 'client-id',
        DATABRICKS_CLIENT_SECRET: '',
      });

      const token = await getServicePrincipalToken(fastify);

      expect(token).toBeUndefined();
    });

    it('should fetch token from Databricks OIDC endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'sp-token-12345',
            expires_in: 3600,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const fastify = createMockFastify({
        DATABRICKS_HOST: 'test.databricks.com',
        DATABRICKS_CLIENT_ID: 'test-client-id',
        DATABRICKS_CLIENT_SECRET: 'test-client-secret',
      });

      const token = await getServicePrincipalToken(fastify);

      expect(token).toBe('sp-token-12345');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.databricks.com/oidc/v1/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      // Verify body contains correct params
      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body as URLSearchParams;
      expect(body.get('grant_type')).toBe('client_credentials');
      expect(body.get('client_id')).toBe('test-client-id');
      expect(body.get('client_secret')).toBe('test-client-secret');
      expect(body.get('scope')).toBe('all-apis');
    });

    it('should return cached token if not expired', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'cached-token',
            expires_in: 3600,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const fastify = createMockFastify({
        DATABRICKS_CLIENT_ID: 'client-id',
        DATABRICKS_CLIENT_SECRET: 'client-secret',
      });

      // First call - fetches token
      const token1 = await getServicePrincipalToken(fastify);
      // Second call - should use cache
      const token2 = await getServicePrincipalToken(fastify);

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should refresh token if expired', async () => {
      // Mock fetch to return different tokens
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: `token-${callCount}`,
              // First token expires immediately (negative buffer)
              expires_in: callCount === 1 ? 0 : 3600,
            }),
        });
      });
      vi.stubGlobal('fetch', mockFetch);

      const fastify = createMockFastify({
        DATABRICKS_CLIENT_ID: 'client-id',
        DATABRICKS_CLIENT_SECRET: 'client-secret',
      });

      // First call
      const token1 = await getServicePrincipalToken(fastify);
      // Second call - token should be expired due to 0 expires_in and 5min buffer
      const token2 = await getServicePrincipalToken(fastify);

      expect(token1).toBe('token-1');
      expect(token2).toBe('token-2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return undefined and log error on fetch failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });
      vi.stubGlobal('fetch', mockFetch);

      const fastify = createMockFastify({
        DATABRICKS_CLIENT_ID: 'client-id',
        DATABRICKS_CLIENT_SECRET: 'client-secret',
      });

      const token = await getServicePrincipalToken(fastify);

      expect(token).toBeUndefined();
      expect(fastify.log.error).toHaveBeenCalled();
    });

    it('should return undefined and log error on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      const fastify = createMockFastify({
        DATABRICKS_CLIENT_ID: 'client-id',
        DATABRICKS_CLIENT_SECRET: 'client-secret',
      });

      const token = await getServicePrincipalToken(fastify);

      expect(token).toBeUndefined();
      expect(fastify.log.error).toHaveBeenCalled();
    });
  });

  describe('getUserPAT', () => {
    it('should return undefined for empty userId', async () => {
      const fastify = createMockFastify();

      const pat = await getUserPAT(fastify, '');

      expect(pat).toBeUndefined();
      expect(fastify.withUserContext).not.toHaveBeenCalled();
    });

    it('should query database with correct parameters', async () => {
      const fastify = createMockFastify();
      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
          return callback(mockTx);
        }
      );
      (fastify.withUserContext as unknown) = mockWithUserContext;

      await getUserPAT(fastify, 'user-123');

      expect(mockWithUserContext).toHaveBeenCalledWith('user-123', expect.any(Function));
    });

    it('should return PAT from database when found', async () => {
      const fastify = createMockFastify();
      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([
              {
                userId: 'user-123',
                provider: 'databricks',
                authType: 'pat',
                accessToken: 'user-pat-token',
              },
            ]),
          };
          return callback(mockTx);
        }
      );
      (fastify.withUserContext as unknown) = mockWithUserContext;

      const pat = await getUserPAT(fastify, 'user-123');

      expect(pat).toBe('user-pat-token');
    });

    it('should return undefined when no PAT found', async () => {
      const fastify = createMockFastify();
      const mockWithUserContext = vi.fn(
        async (_userId: string, callback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            select: vi.fn().mockReturnThis(),
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([]),
          };
          return callback(mockTx);
        }
      );
      (fastify.withUserContext as unknown) = mockWithUserContext;

      const pat = await getUserPAT(fastify, 'user-123');

      expect(pat).toBeUndefined();
    });

    it('should return undefined and log warning on database error', async () => {
      const fastify = createMockFastify();
      const mockWithUserContext = vi.fn().mockRejectedValue(new Error('DB error'));
      (fastify.withUserContext as unknown) = mockWithUserContext;

      const pat = await getUserPAT(fastify, 'user-123');

      expect(pat).toBeUndefined();
      expect(fastify.log.warn).toHaveBeenCalled();
    });
  });

  describe('clearTokenCache', () => {
    it('should clear the SP token cache', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'token-to-clear',
            expires_in: 3600,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const fastify = createMockFastify({
        DATABRICKS_CLIENT_ID: 'client-id',
        DATABRICKS_CLIENT_SECRET: 'client-secret',
      });

      // Fetch and cache token
      await getServicePrincipalToken(fastify);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      clearTokenCache();

      // Should fetch again
      await getServicePrincipalToken(fastify);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
