import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import configPlugin from '../plugins/config.js';
import requestDecoratorPlugin from '../plugins/request-decorator.js';
import titleRoute from './title.js';

// Create mock function for chat.completions.create
const mockCreate = vi.fn();

// Mock OpenAI module
vi.mock('openai', () => {
  const MockOpenAI = function (this: { chat: { completions: { create: MockInstance } } }) {
    this.chat = {
      completions: {
        create: mockCreate,
      },
    };
  };
  return { default: MockOpenAI };
});

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
    it('should return generated title from LLM', async () => {
      // Setup mock response
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'React Component Development',
            },
          },
        ],
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

      // Verify OpenAI was called with correct parameters
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'databricks-claude-haiku-4-5',
        max_tokens: 50,
        messages: [
          {
            role: 'system',
            content:
              'You are a title generator. Generate a short, concise title (3-6 words) for a coding session based on the first message. Respond with only the title, no quotes or extra text.',
          },
          {
            role: 'user',
            content: 'Help me create a React component',
          },
        ],
      });
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
    });

    it('should return fallback title when LLM call fails', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

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

    it('should return fallback title when LLM returns empty content', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '',
            },
          },
        ],
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

    it('should return fallback title when LLM returns null choices', async () => {
      mockCreate.mockResolvedValue({
        choices: [],
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
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '  Python Data Analysis  ',
            },
          },
        ],
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
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'React Component Implementation',
            },
          },
        ],
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

      // Verify the Japanese message was passed to the LLM
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Reactコンポーネントを作成してください',
            }),
          ]),
        })
      );
    });

    it('should use correct model from config', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Test Title',
            },
          },
        ],
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

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'databricks-claude-haiku-4-5',
        })
      );
    });
  });
});
