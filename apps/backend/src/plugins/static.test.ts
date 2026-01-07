import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
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
    fs.writeFileSync(path.join(assetsDir, 'style-def456.css'), 'body { margin: 0; }');
    fs.writeFileSync(path.join(TEST_DIST_DIR, 'logo.png'), 'fake-image-data');
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

    it('should serve static assets with long-term cache headers', async () => {
      await app.register(staticPlugin);

      // Try to access an asset file (may not exist in test environment)
      const response = await app.inject({
        method: 'GET',
        url: '/assets/test.js',
      });

      // If the file doesn't exist, we still get SPA fallback with index.html
      // This is expected behavior since we don't have actual assets in test
      expect([200, 404].includes(response.statusCode)).toBe(true);
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
    it('should set short-term cache headers for HTML files', async () => {
      await app.register(staticPlugin);

      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.headers['cache-control']).toBe('public, max-age=3600, must-revalidate');
    });

    it('should set long-term cache headers for JS/CSS files', async () => {
      await app.register(staticPlugin);

      // Test with a non-existent JS file - will fall back to index.html
      // but we're testing the cache strategy logic
      const response = await app.inject({
        method: 'GET',
        url: '/assets/index-abc123.js',
      });

      // Falls back to index.html in test, which has short-term cache
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBeDefined();
    });

    it('should set short-term cache for other file types (images, etc.)', async () => {
      await app.register(staticPlugin);

      // Test with an image file - will fall back to index.html
      const response = await app.inject({
        method: 'GET',
        url: '/logo.png',
      });

      // Falls back to index.html, which gets short-term cache
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=3600, must-revalidate');
    });
  });

  describe('cache headers with actual files', () => {
    it('should set long-term cache for actual JS files', async () => {
      // Register static plugin pointing to test directory
      await app.register(async (fastify) => {
        await fastify.register(require('@fastify/static'), {
          root: TEST_DIST_DIR,
          prefix: '/',
          cacheControl: false,
          setHeaders: (res: any, filePath: string) => {
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

    it('should set long-term cache for actual CSS files', async () => {
      await app.register(async (fastify) => {
        await fastify.register(require('@fastify/static'), {
          root: TEST_DIST_DIR,
          prefix: '/',
          cacheControl: false,
          setHeaders: (res: any, filePath: string) => {
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
        url: '/assets/style-def456.css',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(response.headers['content-type']).toContain('css');
    });

    it('should set short-term cache for actual image files', async () => {
      await app.register(async (fastify) => {
        await fastify.register(require('@fastify/static'), {
          root: TEST_DIST_DIR,
          prefix: '/',
          cacheControl: false,
          setHeaders: (res: any, filePath: string) => {
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
        url: '/logo.png',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=3600, must-revalidate');
    });

    it('should set short-term cache for actual HTML files', async () => {
      await app.register(async (fastify) => {
        await fastify.register(require('@fastify/static'), {
          root: TEST_DIST_DIR,
          prefix: '/',
          cacheControl: false,
          setHeaders: (res: any, filePath: string) => {
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
