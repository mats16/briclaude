import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import configPlugin from '../plugins/config.js';
import requestDecoratorPlugin from '../plugins/request-decorator.js';
import titleRoute from './title.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('title route', () => {
  let app: FastifyInstance;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set required environment variables
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.DATABRICKS_HOST = 'test.databricks.com';
    process.env.NODE_ENV = 'test';

    // Create a fresh Fastify instance for each test
    app = Fastify({
      logger: false,
    });

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;

    // Close Fastify instance
    await app.close();
  });

  describe('POST /generate_title', () => {
    it('should return generated title from Databricks API', async () => {
      // Setup mock response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'React Component Development',
              },
            },
          ],
        }),
      });

      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Help me create a React component',
        },
        headers: {
          'x-forwarded-access-token': 'test-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('React Component Development');

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.databricks.com/serving-endpoints/databricks-claude-haiku-4-5/invocations',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          },
        })
      );
    });

    it('should return fallback title when first_session_message is missing', async () => {
      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.title).toBe('General coding session');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return fallback title when first_session_message is empty string', async () => {
      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.title).toBe('General coding session');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return fallback title when first_session_message is not a string', async () => {
      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 123,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.title).toBe('General coding session');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return fallback title when API call fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Help me with Python',
        },
        headers: {
          'x-forwarded-access-token': 'test-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('General coding session');
    });

    it('should return fallback title when API returns non-ok status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Help me with Python',
        },
        headers: {
          'x-forwarded-access-token': 'test-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('General coding session');
    });

    it('should return fallback title when API returns empty content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '',
              },
            },
          ],
        }),
      });

      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Help me with something',
        },
        headers: {
          'x-forwarded-access-token': 'test-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('General coding session');
    });

    it('should return fallback title when API returns null choices', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [],
        }),
      });

      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Test message',
        },
        headers: {
          'x-forwarded-access-token': 'test-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('General coding session');
    });

    it('should trim whitespace from generated title', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '  Python Data Analysis  ',
              },
            },
          ],
        }),
      });

      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Analyze this CSV file',
        },
        headers: {
          'x-forwarded-access-token': 'test-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('Python Data Analysis');
    });

    it('should handle Japanese messages', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'React Component Implementation',
              },
            },
          ],
        }),
      });

      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Reactコンポーネントを作成してください',
        },
        headers: {
          'x-forwarded-access-token': 'test-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('React Component Implementation');

      // Verify the Japanese message was passed to the API
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('Reactコンポーネントを作成してください'),
        })
      );
    });

    it('should use correct endpoint from config', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Test Title',
              },
            },
          ],
        }),
      });

      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Test message',
        },
        headers: {
          'x-forwarded-access-token': 'test-token',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.databricks.com/serving-endpoints/databricks-claude-haiku-4-5/invocations',
        expect.any(Object)
      );
    });

    it('should pass oboAccessToken in Authorization header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Test Title',
              },
            },
          ],
        }),
      });

      await app.register(configPlugin);
      await app.register(requestDecoratorPlugin);
      await app.register(titleRoute, { prefix: '/api' });

      await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Test message',
        },
        headers: {
          'x-forwarded-access-token': 'my-secret-token',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-secret-token',
          }),
        })
      );
    });
  });
});
