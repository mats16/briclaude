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

// Mock UserContext
const mockGetAuthProvider = vi.fn();

vi.mock('../lib/user-context.js', () => ({
  createUserContext: vi.fn(() => ({
    userId: 'test-user',
    userHome: '/home/test-user',
    getAuthProvider: mockGetAuthProvider,
    oboAccessToken: undefined,
  })),
}));

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

    // Default: return PAT auth provider
    mockGetAuthProvider.mockResolvedValue({
      type: 'pat',
      getEnvVars: vi.fn(),
      getToken: vi.fn().mockResolvedValue('test-pat-token'),
    });
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;

    // Close Fastify instance
    await app.close();
  });

  async function registerPlugins() {
    await app.register(configPlugin);
    await app.register(requestDecoratorPlugin);

    await app.register(titleRoute, { prefix: '/api' });
  }

  describe('POST /generate_title', () => {
    it('should return generated title from LLM', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'React Component Development',
            },
          },
        ],
      });

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Help me create a React component',
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
            role: 'user',
            content: expect.stringContaining('Help me create a React component'),
          },
        ],
      });
    });

    it('should return 400 with ApiError when first_session_message is missing', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('ValidationError');
      expect(body.message).toBe('first_session_message is required and must be a non-empty string');
      expect(body.statusCode).toBe(400);
    });

    it('should return 400 with ApiError when first_session_message is empty string', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('ValidationError');
    });

    it('should return 400 with ApiError when first_session_message is not a string', async () => {
      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 123,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('ValidationError');
    });

    it('should return 401 when no token is available (SP token fetch fails)', async () => {
      // Mock: SP auth provider that throws on getToken
      mockGetAuthProvider.mockResolvedValue({
        type: 'oauth-m2m',
        getEnvVars: vi.fn(),
        getToken: vi.fn().mockRejectedValue(new Error('Service Principal token is not available')),
      });

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Help me with Python',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('Unauthorized');
      expect(body.message).toBe('Access token is required (PAT or Service Principal)');
    });

    it('should use SP token when PAT is not available', async () => {
      // Mock: SP auth provider
      mockGetAuthProvider.mockResolvedValue({
        type: 'oauth-m2m',
        getEnvVars: vi.fn(),
        getToken: vi.fn().mockResolvedValue('test-sp-token'),
      });

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'SP Token Test',
            },
          },
        ],
      });

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Test with SP token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('SP Token Test');
    });

    it('should use PAT auth provider when available', async () => {
      // Mock: PAT auth provider
      const mockAccessToken = vi.fn().mockResolvedValue('test-pat-token');
      mockGetAuthProvider.mockResolvedValue({
        type: 'pat',
        getEnvVars: vi.fn(),
        getToken: mockAccessToken,
      });

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'PAT Priority Test',
            },
          },
        ],
      });

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Test PAT priority',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('PAT Priority Test');

      // Verify that getToken was called
      expect(mockAccessToken).toHaveBeenCalled();
    });

    it('should return 500 with ApiError when LLM call fails', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Help me with Python',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = response.json();
      expect(body.error).toBe('InternalServerError');
      expect(body.message).toBe('Failed to generate title');
      expect(body.statusCode).toBe(500);
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

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Help me with something',
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

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Test message',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('General coding session');
    });

    it('should clean up LLM artifacts - remove surrounding quotes', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '"Python Data Analysis"',
            },
          },
        ],
      });

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Analyze this CSV file',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('Python Data Analysis');
    });

    it('should clean up LLM artifacts - remove markdown formatting', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '**React Component** Development',
            },
          },
        ],
      });

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Create a React component',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('React Component Development');
    });

    it('should clean up LLM artifacts - remove backticks', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '`API Integration`',
            },
          },
        ],
      });

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Help me integrate an API',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('API Integration');
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

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Analyze this CSV file',
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

      await registerPlugins();

      const response = await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Reactコンポーネントを作成してください',
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
              content: expect.stringContaining('Reactコンポーネントを作成してください'),
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

      await registerPlugins();

      await app.inject({
        method: 'POST',
        url: '/api/generate_title',
        payload: {
          first_session_message: 'Test message',
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
