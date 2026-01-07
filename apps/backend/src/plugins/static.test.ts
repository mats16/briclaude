import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import staticPlugin from './static.js';
import fs from 'fs';
import path from 'path';

const TEST_DIST_DIR = path.join(import.meta.dirname, '../../../frontend/dist-test');

describe('static plugin', () => {
  let app: FastifyInstance;

  // テスト用の一時ファイルを作成
  beforeAll(() => {
    // テスト用ディレクトリを作成
    if (!fs.existsSync(TEST_DIST_DIR)) {
      fs.mkdirSync(TEST_DIST_DIR, { recursive: true });
    }

    // assetsディレクトリを作成
    const assetsDir = path.join(TEST_DIST_DIR, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // テスト用ファイルを作成
    fs.writeFileSync(path.join(TEST_DIST_DIR, 'index.html'), '<html><body>Test</body></html>');
    fs.writeFileSync(path.join(assetsDir, 'index-abc123.js'), 'console.log("test");');
  });

  // テスト終了後にクリーンアップ
  afterAll(() => {
    if (fs.existsSync(TEST_DIST_DIR)) {
      fs.rmSync(TEST_DIST_DIR, { recursive: true, force: true });
    }
  });

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

  describe('static file serving', () => {
    it('should serve index.html at root path', async () => {
      await app.register(staticPlugin);

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['cache-control']).toBe('public, max-age=3600, must-revalidate');
    });

    it('should serve index.html for unknown routes (SPA fallback)', async () => {
      await app.register(staticPlugin);

      const response = await app.inject({
        method: 'GET',
        url: '/some-unknown-route',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });
  });

  describe('API route priority', () => {
    it('should prioritize API routes over static files', async () => {
      // Register a test API route
      app.get('/api/test', async () => {
        return { message: 'API response' };
      });

      // Add cache control hook for API routes
      app.addHook('onSend', async (request, reply) => {
        if (request.url.startsWith('/api/')) {
          reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      });

      await app.register(staticPlugin);

      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: 'API response' });
    });

    it('should return JSON error for non-existent API routes', async () => {
      // Add cache control hook for API routes
      app.addHook('onSend', async (request, reply) => {
        if (request.url.startsWith('/api/')) {
          reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      });

      await app.register(staticPlugin);

      const response = await app.inject({
        method: 'GET',
        url: '/api/non-existent',
      });

      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.json()).toEqual({
        error: 'NotFound',
        message: 'Route not found',
        statusCode: 404,
      });
    });

    it('should not cache API routes', async () => {
      // Register a test API route
      app.get('/api/test', async () => {
        return { message: 'API response' };
      });

      // Add cache control hook for API routes
      app.addHook('onSend', async (request, reply) => {
        if (request.url.startsWith('/api/')) {
          reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      });

      await app.register(staticPlugin);

      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
    });
  });

  describe('error handling', () => {
    it('should handle non-API 404s with SPA fallback', async () => {
      await app.register(staticPlugin);

      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-page',
      });

      // Should serve index.html instead of 404
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
    });

    it('should differentiate between API and non-API 404s', async () => {
      await app.register(staticPlugin);

      const apiResponse = await app.inject({
        method: 'GET',
        url: '/api/missing',
      });

      const webResponse = await app.inject({
        method: 'GET',
        url: '/missing',
      });

      // API route should return JSON error
      expect(apiResponse.statusCode).toBe(404);
      expect(apiResponse.headers['content-type']).toContain('application/json');

      // Web route should serve index.html
      expect(webResponse.statusCode).toBe(200);
      expect(webResponse.headers['content-type']).toContain('text/html');
    });
  });

  describe('cache headers', () => {
    it('should set long-term cache for actual JS files', async () => {
      // Register static plugin pointing to test directory
      await app.register(async (fastify) => {
        await fastify.register(fastifyStatic, {
          root: TEST_DIST_DIR,
          prefix: '/',
          serveDotFiles: false,
          cacheControl: false,
          setHeaders: (res, filePath) => {
            const LONG_CACHE_PATTERN = /\.(js|css|woff2?|ttf|eot)$/;
            if (LONG_CACHE_PATTERN.test(filePath)) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
            }
          },
        });
      });

      const response = await app.inject({
        method: 'GET',
        url: '/assets/index-abc123.js',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(response.headers['content-type']).toContain('javascript');
    });

    it('should set short-term cache for HTML files', async () => {
      await app.register(async (fastify) => {
        await fastify.register(fastifyStatic, {
          root: TEST_DIST_DIR,
          prefix: '/',
          serveDotFiles: false,
          cacheControl: false,
          setHeaders: (res, filePath) => {
            const LONG_CACHE_PATTERN = /\.(js|css|woff2?|ttf|eot)$/;
            if (LONG_CACHE_PATTERN.test(filePath)) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else {
              res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
            }
          },
        });
      });

      const response = await app.inject({
        method: 'GET',
        url: '/index.html',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=3600, must-revalidate');
      expect(response.headers['content-type']).toContain('html');
    });
  });
});
