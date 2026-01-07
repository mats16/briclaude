import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import requestDecoratorPlugin from './request-decorator.js';

describe('request-decorator plugin', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    // Create a fresh Fastify instance for each test
    app = Fastify({
      logger: false, // Disable logging in tests
    });
  });

  afterEach(async () => {
    // Close Fastify instance
    await app.close();
  });

  describe('successful context extraction', () => {
    it('should extract all Databricks headers into request context', async () => {
      await app.register(requestDecoratorPlugin);

      app.get('/test', async request => {
        return {
          host: request.ctx?.host,
          requestId: request.ctx?.requestId,
          realIp: request.ctx?.realIp,
          userId: request.ctx?.user.id,
          userName: request.ctx?.user.name,
          userEmail: request.ctx?.user.email,
          oboAccessToken: request.ctx?.user.oboAccessToken,
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-host': 'app.databricks.com',
          'x-request-id': 'test-request-123',
          'x-real-ip': '192.168.1.1',
          'x-forwarded-user': 'user-123',
          'x-forwarded-preferred-username': 'john.doe',
          'x-forwarded-email': 'john.doe@example.com',
          'x-forwarded-access-token': 'token-abc-xyz',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.host).toBe('app.databricks.com');
      expect(body.requestId).toBe('test-request-123');
      expect(body.realIp).toBe('192.168.1.1');
      expect(body.userId).toBe('user-123');
      expect(body.userName).toBe('john.doe');
      expect(body.userEmail).toBe('john.doe@example.com');
      expect(body.oboAccessToken).toBe('token-abc-xyz');
    });

    it('should make ctx accessible in routes', async () => {
      await app.register(requestDecoratorPlugin);

      app.get('/test-ctx', async request => {
        expect(request.ctx).toBeDefined();
        expect(request.ctx).not.toBeNull();
        return { hasContext: request.ctx !== null };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test-ctx',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().hasContext).toBe(true);
    });
  });

  describe('fallback values', () => {
    it('should use fallback values when headers are missing', async () => {
      await app.register(requestDecoratorPlugin);

      app.get('/test', async request => {
        return {
          host: request.ctx?.host,
          requestId: request.ctx?.requestId,
          realIp: request.ctx?.realIp,
          userId: request.ctx?.user.id,
          userName: request.ctx?.user.name,
          userEmail: request.ctx?.user.email,
          oboAccessToken: request.ctx?.user.oboAccessToken,
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        // No custom headers provided
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Should fallback to req.hostname, req.ip, and empty strings for user info
      expect(body.host).toBeDefined();
      expect(body.realIp).toBeDefined();

      // User info should be empty strings
      expect(body.userId).toBe('');
      expect(body.userName).toBe('');
      expect(body.userEmail).toBe('');
      expect(body.oboAccessToken).toBe('');

      // requestId should be a valid UUID
      expect(body.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should generate UUID for requestId when x-request-id is missing', async () => {
      await app.register(requestDecoratorPlugin);

      app.get('/test', async request => {
        return { requestId: request.ctx?.requestId };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-host': 'app.databricks.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Should be a valid UUID v4 format
      expect(body.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should use req.hostname when x-forwarded-host is missing', async () => {
      await app.register(requestDecoratorPlugin);

      app.get('/test', async request => {
        return { host: request.ctx?.host };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Should use the default hostname from Fastify inject
      expect(body.host).toBe('localhost');
    });

    it('should use req.ip when x-real-ip is missing', async () => {
      await app.register(requestDecoratorPlugin);

      app.get('/test', async request => {
        return { realIp: request.ctx?.realIp };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Should use the default IP from Fastify inject
      expect(body.realIp).toBeDefined();
      expect(typeof body.realIp).toBe('string');
    });
  });

  describe('partial header scenarios', () => {
    it('should handle partial user headers correctly', async () => {
      await app.register(requestDecoratorPlugin);

      app.get('/test', async request => {
        return {
          userId: request.ctx?.user.id,
          userName: request.ctx?.user.name,
          userEmail: request.ctx?.user.email,
          oboAccessToken: request.ctx?.user.oboAccessToken,
        };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-user': 'user-456',
          'x-forwarded-email': 'jane@example.com',
          // Missing: x-forwarded-preferred-username and x-forwarded-access-token
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.userId).toBe('user-456');
      expect(body.userEmail).toBe('jane@example.com');
      expect(body.userName).toBe(''); // Should be empty string
      expect(body.oboAccessToken).toBe(''); // Should be empty string
    });
  });

  describe('context type safety', () => {
    it('should have ctx property available on request', async () => {
      await app.register(requestDecoratorPlugin);

      app.get('/test', async request => {
        // TypeScript should allow accessing request.ctx
        const context = request.ctx;
        expect(context).toBeDefined();

        if (context) {
          expect(context.host).toBeDefined();
          expect(context.requestId).toBeDefined();
          expect(context.realIp).toBeDefined();
          expect(context.user).toBeDefined();
          expect(context.user.id).toBeDefined();
          expect(context.user.name).toBeDefined();
          expect(context.user.email).toBeDefined();
          expect(context.user.oboAccessToken).toBeDefined();
        }

        return { success: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('multiple requests', () => {
    it('should generate unique requestIds for different requests', async () => {
      await app.register(requestDecoratorPlugin);

      const requestIds: string[] = [];

      app.get('/test', async request => {
        return { requestId: request.ctx?.requestId };
      });

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/test',
        });

        expect(response.statusCode).toBe(200);
        requestIds.push(response.json().requestId);
      }

      // All requestIds should be unique
      const uniqueIds = new Set(requestIds);
      expect(uniqueIds.size).toBe(5);
    });

    it('should handle different user contexts per request', async () => {
      await app.register(requestDecoratorPlugin);

      app.get('/test', async request => {
        return {
          userId: request.ctx?.user.id,
          userName: request.ctx?.user.name,
        };
      });

      const response1 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-user': 'user-1',
          'x-forwarded-preferred-username': 'alice',
        },
      });

      const response2 = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'x-forwarded-user': 'user-2',
          'x-forwarded-preferred-username': 'bob',
        },
      });

      expect(response1.statusCode).toBe(200);
      expect(response2.statusCode).toBe(200);

      const body1 = response1.json();
      const body2 = response2.json();

      expect(body1.userId).toBe('user-1');
      expect(body1.userName).toBe('alice');
      expect(body2.userId).toBe('user-2');
      expect(body2.userName).toBe('bob');
    });
  });
});
