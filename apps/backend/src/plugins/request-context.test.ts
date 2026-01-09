import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import requestContextPlugin, { requestContext } from './request-context.js';
import { clearTokenCache } from '../services/token-resolver.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFastify = any;

// Mock config plugin
const mockConfigPlugin = fp(
  async (fastify: AnyFastify) => {
    fastify.decorate('config', {
      DATABASE_URL: 'postgresql://localhost:5432/test',
      ENCRYPTION_KEY: 'a'.repeat(64),
      DATABRICKS_HOST: 'test.databricks.com',
      DATABRICKS_CLIENT_ID: '',
      DATABRICKS_CLIENT_SECRET: '',
      NODE_ENV: 'test',
      PORT: 8000,
      DATABRICKS_APP_PORT: 8000,
      SQL_WAREHOUSE_ID: '',
      DATABRICKS_APP_NAME: '',
      DATABRICKS_WORKSPACE_ID: '',
      USER_BASE_DIR: '/tmp/users',
      SESSION_BASE_DIR: '/tmp/ws',
      DISABLE_AUTO_MIGRATION: false,
      ANTHROPIC_BASE_URL: 'https://test.databricks.com/serving-endpoints/anthropic',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'databricks-claude-opus-4-5',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'databricks-claude-sonnet-4-5',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'databricks-claude-haiku-4-5',
      HOME: '/tmp',
      PATH: '/usr/bin',
    });
  },
  { name: 'config' }
);

// Mock database plugin (no PAT)
const mockDatabasePlugin = fp(
  async (fastify: AnyFastify) => {
    fastify.decorate('db', {});
    fastify.decorate(
      'withUserContext',
      async <T>(_userId: string, callback: (tx: unknown) => Promise<T>): Promise<T> => {
        const mockTx = {
          select: () => ({
            from: () => ({
              where: () => Promise.resolve([]),
            }),
          }),
        };
        return callback(mockTx);
      }
    );
  },
  { name: 'db', dependencies: ['config'] }
);

// Mock request-decorator plugin
const mockRequestDecoratorPlugin = fp(
  async (fastify: AnyFastify) => {
    fastify.decorateRequest('ctx', null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fastify.addHook('preHandler', async (request: any) => {
      const userId = (request.headers['x-forwarded-user'] as string) ?? '';
      const userName = (request.headers['x-forwarded-preferred-username'] as string) ?? '';
      const userEmail = (request.headers['x-forwarded-email'] as string) ?? '';
      const oboAccessToken = (request.headers['x-forwarded-access-token'] as string) ?? '';

      request.ctx = {
        host: 'localhost',
        requestId: 'test-request-id',
        realIp: '127.0.0.1',
        user: {
          id: userId,
          name: userName,
          email: userEmail,
          oboAccessToken,
        },
      };
    });
  },
  { name: 'request-decorator', dependencies: ['config'] }
);

describe('request-context plugin', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    clearTokenCache();
    app = Fastify({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('plugin initialization', () => {
    it('should initialize without SP credentials', async () => {
      await app.register(mockConfigPlugin);
      await app.register(mockDatabasePlugin);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      expect(app).toBeDefined();
    });

    it('should make individual tokens available in routes', async () => {
      await app.register(mockConfigPlugin);
      await app.register(mockDatabasePlugin);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      app.get('/test', async () => {
        return {
          pat: requestContext.get('pat'),
          obo_access_token: requestContext.get('obo_access_token'),
          sp_access_token: requestContext.get('sp_access_token'),
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('pat');
      expect(body).toHaveProperty('obo_access_token');
      expect(body).toHaveProperty('sp_access_token');
    });
  });

  describe('PAT retrieval', () => {
    it('should return null when no PAT in database', async () => {
      await app.register(mockConfigPlugin);
      await app.register(mockDatabasePlugin);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      app.get('/test', async () => {
        return { pat: requestContext.get('pat') };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-forwarded-user': 'test-user-123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().pat).toBeNull();
    });

    it('should return PAT from database when available', async () => {
      const mockDatabaseWithPAT = fp(
        async (fastify: AnyFastify) => {
          fastify.decorate('db', {});
          fastify.decorate(
            'withUserContext',
            async <T>(_userId: string, callback: (tx: unknown) => Promise<T>): Promise<T> => {
              const mockTx = {
                select: () => ({
                  from: () => ({
                    where: () =>
                      Promise.resolve([
                        {
                          userId: 'test-user-123',
                          provider: 'databricks',
                          authType: 'pat',
                          accessToken: 'user-pat-token-12345',
                        },
                      ]),
                  }),
                }),
              };
              return callback(mockTx);
            }
          );
        },
        { name: 'db', dependencies: ['config'] }
      );

      await app.register(mockConfigPlugin);
      await app.register(mockDatabaseWithPAT);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      app.get('/test', async () => {
        return { pat: requestContext.get('pat') };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-forwarded-user': 'test-user-123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().pat).toBe('user-pat-token-12345');
    });
  });

  describe('OBO token retrieval', () => {
    it('should return null when no OBO token in header', async () => {
      await app.register(mockConfigPlugin);
      await app.register(mockDatabasePlugin);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      app.get('/test', async () => {
        return { obo_access_token: requestContext.get('obo_access_token') };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().obo_access_token).toBeNull();
    });

    it('should return OBO token from header when available', async () => {
      await app.register(mockConfigPlugin);
      await app.register(mockDatabasePlugin);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      app.get('/test', async () => {
        return { obo_access_token: requestContext.get('obo_access_token') };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-forwarded-access-token': 'obo-token-abc123' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().obo_access_token).toBe('obo-token-abc123');
    });
  });

  describe('SP token retrieval', () => {
    it('should return null when no SP credentials configured', async () => {
      await app.register(mockConfigPlugin);
      await app.register(mockDatabasePlugin);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      app.get('/test', async () => {
        return { sp_access_token: requestContext.get('sp_access_token') };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().sp_access_token).toBeNull();
    });

    it('should fetch and return SP token when credentials configured', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'sp-token-xyz789',
            expires_in: 3600,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const mockConfigWithSP = fp(
        async (fastify: AnyFastify) => {
          fastify.decorate('config', {
            ...mockConfigPlugin,
            DATABASE_URL: 'postgresql://localhost:5432/test',
            ENCRYPTION_KEY: 'a'.repeat(64),
            DATABRICKS_HOST: 'test.databricks.com',
            DATABRICKS_CLIENT_ID: 'test-client-id',
            DATABRICKS_CLIENT_SECRET: 'test-client-secret',
            NODE_ENV: 'test',
            PORT: 8000,
            DATABRICKS_APP_PORT: 8000,
            SQL_WAREHOUSE_ID: '',
            DATABRICKS_APP_NAME: '',
            DATABRICKS_WORKSPACE_ID: '',
            USER_BASE_DIR: '/tmp/users',
            SESSION_BASE_DIR: '/tmp/ws',
            DISABLE_AUTO_MIGRATION: false,
            ANTHROPIC_BASE_URL: 'https://test.databricks.com/serving-endpoints/anthropic',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'databricks-claude-opus-4-5',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'databricks-claude-sonnet-4-5',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'databricks-claude-haiku-4-5',
            HOME: '/tmp',
            PATH: '/usr/bin',
          });
        },
        { name: 'config' }
      );

      await app.register(mockConfigWithSP);
      await app.register(mockDatabasePlugin);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      app.get('/test', async () => {
        return { sp_access_token: requestContext.get('sp_access_token') };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().sp_access_token).toBe('sp-token-xyz789');

      vi.unstubAllGlobals();
    });

    it('should cache SP token and reuse it', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'sp-token-cached',
            expires_in: 3600,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const mockConfigWithSP = fp(
        async (fastify: AnyFastify) => {
          fastify.decorate('config', {
            DATABASE_URL: 'postgresql://localhost:5432/test',
            ENCRYPTION_KEY: 'a'.repeat(64),
            DATABRICKS_HOST: 'test.databricks.com',
            DATABRICKS_CLIENT_ID: 'test-client-id',
            DATABRICKS_CLIENT_SECRET: 'test-client-secret',
            NODE_ENV: 'test',
            PORT: 8000,
            DATABRICKS_APP_PORT: 8000,
            SQL_WAREHOUSE_ID: '',
            DATABRICKS_APP_NAME: '',
            DATABRICKS_WORKSPACE_ID: '',
            USER_BASE_DIR: '/tmp/users',
            SESSION_BASE_DIR: '/tmp/ws',
            DISABLE_AUTO_MIGRATION: false,
            ANTHROPIC_BASE_URL: 'https://test.databricks.com/serving-endpoints/anthropic',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'databricks-claude-opus-4-5',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'databricks-claude-sonnet-4-5',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'databricks-claude-haiku-4-5',
            HOME: '/tmp',
            PATH: '/usr/bin',
          });
        },
        { name: 'config' }
      );

      await app.register(mockConfigWithSP);
      await app.register(mockDatabasePlugin);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      app.get('/test', async () => {
        return { sp_access_token: requestContext.get('sp_access_token') };
      });

      // First request
      await app.inject({ method: 'GET', url: '/test' });
      // Second request
      await app.inject({ method: 'GET', url: '/test' });

      // Should only call fetch once (cached)
      expect(mockFetch).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });
  });

  describe('all tokens together', () => {
    it('should retrieve all tokens in parallel', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'sp-token-parallel',
            expires_in: 3600,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const mockConfigWithSP = fp(
        async (fastify: AnyFastify) => {
          fastify.decorate('config', {
            DATABASE_URL: 'postgresql://localhost:5432/test',
            ENCRYPTION_KEY: 'a'.repeat(64),
            DATABRICKS_HOST: 'test.databricks.com',
            DATABRICKS_CLIENT_ID: 'test-client-id',
            DATABRICKS_CLIENT_SECRET: 'test-client-secret',
            NODE_ENV: 'test',
            PORT: 8000,
            DATABRICKS_APP_PORT: 8000,
            SQL_WAREHOUSE_ID: '',
            DATABRICKS_APP_NAME: '',
            DATABRICKS_WORKSPACE_ID: '',
            USER_BASE_DIR: '/tmp/users',
            SESSION_BASE_DIR: '/tmp/ws',
            DISABLE_AUTO_MIGRATION: false,
            ANTHROPIC_BASE_URL: 'https://test.databricks.com/serving-endpoints/anthropic',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'databricks-claude-opus-4-5',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'databricks-claude-sonnet-4-5',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'databricks-claude-haiku-4-5',
            HOME: '/tmp',
            PATH: '/usr/bin',
          });
        },
        { name: 'config' }
      );

      const mockDatabaseWithPAT = fp(
        async (fastify: AnyFastify) => {
          fastify.decorate('db', {});
          fastify.decorate(
            'withUserContext',
            async <T>(_userId: string, callback: (tx: unknown) => Promise<T>): Promise<T> => {
              const mockTx = {
                select: () => ({
                  from: () => ({
                    where: () =>
                      Promise.resolve([
                        {
                          userId: 'test-user',
                          provider: 'databricks',
                          authType: 'pat',
                          accessToken: 'user-pat-parallel',
                        },
                      ]),
                  }),
                }),
              };
              return callback(mockTx);
            }
          );
        },
        { name: 'db', dependencies: ['config'] }
      );

      await app.register(mockConfigWithSP);
      await app.register(mockDatabaseWithPAT);
      await app.register(mockRequestDecoratorPlugin);
      await app.register(requestContextPlugin);

      app.get('/test', async () => {
        return {
          pat: requestContext.get('pat'),
          obo_access_token: requestContext.get('obo_access_token'),
          sp_access_token: requestContext.get('sp_access_token'),
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-user': 'test-user',
          'x-forwarded-access-token': 'obo-token-parallel',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.pat).toBe('user-pat-parallel');
      expect(body.obo_access_token).toBe('obo-token-parallel');
      expect(body.sp_access_token).toBe('sp-token-parallel');

      vi.unstubAllGlobals();
    });
  });
});
