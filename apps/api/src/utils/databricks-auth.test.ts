// apps/api/src/utils/databricks-auth.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getServicePrincipalToken, clearSpTokenCache } from './databricks-auth.js';

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
});
