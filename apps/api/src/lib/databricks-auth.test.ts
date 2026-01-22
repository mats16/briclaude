// apps/api/src/lib/databricks-auth.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  getServicePrincipalToken,
  getUserPAT,
  clearSpTokenCache,
  getAuthProvider,
  type PatEnvVars,
  type ServicePrincipalEnvVars,
} from './databricks-auth.js';

describe('databricks-auth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearSpTokenCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('getServicePrincipalToken', () => {
    it('should return undefined when clientId is not provided', async () => {
      delete process.env.DATABRICKS_CLIENT_ID;
      delete process.env.DATABRICKS_CLIENT_SECRET;

      const token = await getServicePrincipalToken('example.databricks.com');
      expect(token).toBeUndefined();
    });

    it('should return undefined when clientSecret is not provided', async () => {
      delete process.env.DATABRICKS_CLIENT_ID;
      delete process.env.DATABRICKS_CLIENT_SECRET;

      const token = await getServicePrincipalToken('example.databricks.com', 'client-id');
      expect(token).toBeUndefined();
    });

    it('should fetch token with provided credentials', async () => {
      const mockResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const token = await getServicePrincipalToken(
        'example.databricks.com',
        'client-id',
        'client-secret'
      );

      expect(token).toBe('test-token');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.databricks.com/oidc/v1/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('should normalize host with https:// prefix', async () => {
      const mockResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getServicePrincipalToken(
        'https://example.databricks.com',
        'client-id',
        'client-secret'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.databricks.com/oidc/v1/token',
        expect.any(Object)
      );
    });

    it('should use environment variables when credentials not provided', async () => {
      process.env.DATABRICKS_CLIENT_ID = 'env-client-id';
      process.env.DATABRICKS_CLIENT_SECRET = 'env-client-secret';

      const mockResponse = {
        access_token: 'env-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const token = await getServicePrincipalToken('example.databricks.com');

      expect(token).toBe('env-token');
    });

    it('should cache token and return cached value on subsequent calls', async () => {
      const mockResponse = {
        access_token: 'cached-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // First call
      const token1 = await getServicePrincipalToken(
        'example.databricks.com',
        'client-id',
        'client-secret'
      );

      // Second call
      const token2 = await getServicePrincipalToken(
        'example.databricks.com',
        'client-id',
        'client-secret'
      );

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error when fetch fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(
        getServicePrincipalToken('example.databricks.com', 'client-id', 'client-secret')
      ).rejects.toThrow('Failed to fetch SP token (401): Unauthorized');
    });

    it('should use default expires_in of 3600 when not provided', async () => {
      const mockResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        // expires_in is not provided
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const token = await getServicePrincipalToken(
        'example.databricks.com',
        'client-id',
        'client-secret'
      );

      expect(token).toBe('test-token');
    });
  });

  describe('clearSpTokenCache', () => {
    it('should clear the token cache', async () => {
      const mockResponse = {
        access_token: 'first-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      // First call
      await getServicePrincipalToken('example.databricks.com', 'client-id', 'client-secret');

      // Clear cache
      clearSpTokenCache();

      // Update mock for second call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'second-token',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
      });

      // Second call should fetch new token
      const token = await getServicePrincipalToken(
        'example.databricks.com',
        'client-id',
        'client-secret'
      );

      expect(token).toBe('second-token');
    });
  });

  describe('getUserPAT', () => {
    it('should return undefined when userId is empty', async () => {
      const mockFastify = {} as FastifyInstance;

      const token = await getUserPAT(mockFastify, '');

      expect(token).toBeUndefined();
    });

    it('should fetch PAT from database', async () => {
      const mockWithUserContext = vi.fn().mockImplementation(async (_userId, callback) => {
        return callback({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => [{ accessToken: 'user-pat-token' }],
              }),
            }),
          }),
        });
      });

      const mockFastify = {
        withUserContext: mockWithUserContext,
        log: {
          warn: vi.fn(),
        },
      } as unknown as FastifyInstance;

      const token = await getUserPAT(mockFastify, 'user@example.com');

      expect(token).toBe('user-pat-token');
      expect(mockWithUserContext).toHaveBeenCalledWith('user@example.com', expect.any(Function));
    });

    it('should return undefined when PAT not found', async () => {
      const mockWithUserContext = vi.fn().mockImplementation(async (_userId, callback) => {
        return callback({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => [],
              }),
            }),
          }),
        });
      });

      const mockFastify = {
        withUserContext: mockWithUserContext,
        log: {
          warn: vi.fn(),
        },
      } as unknown as FastifyInstance;

      const token = await getUserPAT(mockFastify, 'user@example.com');

      expect(token).toBeUndefined();
    });

    it('should return undefined and log warning when database error occurs', async () => {
      const mockLogWarn = vi.fn();
      const mockWithUserContext = vi.fn().mockRejectedValue(new Error('DB error'));

      const mockFastify = {
        withUserContext: mockWithUserContext,
        log: {
          warn: mockLogWarn,
        },
      } as unknown as FastifyInstance;

      const token = await getUserPAT(mockFastify, 'user@example.com');

      expect(token).toBeUndefined();
      expect(mockLogWarn).toHaveBeenCalled();
    });
  });

  describe('getAuthProvider', () => {
    const mockConfig = {
      DATABRICKS_HOST: 'example.databricks.com',
      DATABRICKS_CLIENT_ID: 'sp-client-id',
      DATABRICKS_CLIENT_SECRET: 'sp-client-secret',
    };

    // Helper to create mock Fastify with PAT
    function createMockFastifyWithPAT(patToken: string | undefined) {
      const mockWithUserContext = vi.fn().mockImplementation(async (_userId, callback) => {
        return callback({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () => (patToken ? [{ accessToken: patToken }] : []),
              }),
            }),
          }),
        });
      });

      return {
        config: mockConfig,
        withUserContext: mockWithUserContext,
        log: { warn: vi.fn() },
      } as unknown as FastifyInstance;
    }

    describe('principalType = auto (default)', () => {
      it('should return PAT provider when PAT is registered', async () => {
        const mockFastify = createMockFastifyWithPAT('user-pat-token');

        const authProvider = await getAuthProvider(mockFastify, 'user@example.com');

        expect(authProvider.type).toBe('pat');
        const envVars = authProvider.getEnvVars() as PatEnvVars;
        expect(envVars.DATABRICKS_AUTH_TYPE).toBe('pat');
        expect(envVars.DATABRICKS_TOKEN).toBe('user-pat-token');
      });

      it('should return SP provider when PAT is not registered', async () => {
        const mockFastify = createMockFastifyWithPAT(undefined);

        const authProvider = await getAuthProvider(mockFastify, 'user@example.com');

        expect(authProvider.type).toBe('oauth-m2m');
        const envVars = authProvider.getEnvVars() as ServicePrincipalEnvVars;
        expect(envVars.DATABRICKS_AUTH_TYPE).toBe('oauth-m2m');
        expect(envVars.DATABRICKS_CLIENT_ID).toBe('sp-client-id');
      });
    });

    describe('principalType = pat', () => {
      it('should return PAT provider when PAT is registered', async () => {
        const mockFastify = createMockFastifyWithPAT('user-pat-token');

        const authProvider = await getAuthProvider(mockFastify, 'user@example.com', 'pat');

        expect(authProvider.type).toBe('pat');
        const envVars = authProvider.getEnvVars() as PatEnvVars;
        expect(envVars.DATABRICKS_AUTH_TYPE).toBe('pat');
        expect(envVars.DATABRICKS_TOKEN).toBe('user-pat-token');
      });

      it('should throw error when PAT is not registered', async () => {
        const mockFastify = createMockFastifyWithPAT(undefined);

        await expect(getAuthProvider(mockFastify, 'user@example.com', 'pat')).rejects.toThrow(
          'PAT is not registered'
        );
      });
    });

    describe('principalType = sp', () => {
      it('should return SP provider even when PAT is registered', async () => {
        const mockFastify = createMockFastifyWithPAT('user-pat-token');

        const authProvider = await getAuthProvider(mockFastify, 'user@example.com', 'sp');

        expect(authProvider.type).toBe('oauth-m2m');
        const envVars = authProvider.getEnvVars() as ServicePrincipalEnvVars;
        expect(envVars.DATABRICKS_AUTH_TYPE).toBe('oauth-m2m');
        expect(envVars.DATABRICKS_CLIENT_ID).toBe('sp-client-id');
      });

      it('should return SP provider when PAT is not registered', async () => {
        const mockFastify = createMockFastifyWithPAT(undefined);

        const authProvider = await getAuthProvider(mockFastify, 'user@example.com', 'sp');

        expect(authProvider.type).toBe('oauth-m2m');
        const envVars = authProvider.getEnvVars() as ServicePrincipalEnvVars;
        expect(envVars.DATABRICKS_AUTH_TYPE).toBe('oauth-m2m');
        expect(envVars.DATABRICKS_CLIENT_ID).toBe('sp-client-id');
      });

      it('should not call getUserPAT when principalType is sp', async () => {
        const mockWithUserContext = vi.fn();
        const mockFastify = {
          config: mockConfig,
          withUserContext: mockWithUserContext,
          log: { warn: vi.fn() },
        } as unknown as FastifyInstance;

        await getAuthProvider(mockFastify, 'user@example.com', 'sp');

        // withUserContext should not be called because we skip PAT lookup
        expect(mockWithUserContext).not.toHaveBeenCalled();
      });
    });
  });
});
