import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { TitleService, type TitleServiceConfig } from './title.service.js';

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

describe('TitleService', () => {
  let service: TitleService;
  const defaultConfig: TitleServiceConfig = {
    databricksHost: 'test.databricks.com',
    model: 'databricks-claude-haiku-4-5',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TitleService(defaultConfig);
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      const config: TitleServiceConfig = {
        databricksHost: 'custom.databricks.com',
        model: 'custom-model',
      };
      const customService = new TitleService(config);
      expect(customService).toBeInstanceOf(TitleService);
    });
  });

  describe('generateTitle', () => {
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

      const title = await service.generateTitle({
        firstSessionMessage: 'Help me create a React component',
        accessToken: 'test-token',
      });

      expect(title).toBe('React Component Development');
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

      const title = await service.generateTitle({
        firstSessionMessage: 'Test message',
        accessToken: 'test-token',
      });

      expect(title).toBe('General coding session');
    });

    it('should return fallback title when choices array is empty', async () => {
      mockCreate.mockResolvedValue({
        choices: [],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Test message',
        accessToken: 'test-token',
      });

      expect(title).toBe('General coding session');
    });

    it('should return fallback title when message content is null', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Test message',
        accessToken: 'test-token',
      });

      expect(title).toBe('General coding session');
    });

    it('should throw error when API fails', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      await expect(
        service.generateTitle({
          firstSessionMessage: 'Test message',
          accessToken: 'test-token',
        })
      ).rejects.toThrow('API error');
    });

    it('should clean double quotes from title', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '"Python Data Analysis"' } }],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Analyze CSV',
        accessToken: 'test-token',
      });

      expect(title).toBe('Python Data Analysis');
    });

    it('should clean single quotes from title', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "'React Component'" } }],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Create React component',
        accessToken: 'test-token',
      });

      expect(title).toBe('React Component');
    });

    it('should clean backticks from title', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '`API Integration`' } }],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Integrate API',
        accessToken: 'test-token',
      });

      expect(title).toBe('API Integration');
    });

    it('should clean markdown bold formatting', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '**React Component** Development' } }],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Create React component',
        accessToken: 'test-token',
      });

      expect(title).toBe('React Component Development');
    });

    it('should clean markdown italic formatting', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '*React Component* Development' } }],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Create React component',
        accessToken: 'test-token',
      });

      expect(title).toBe('React Component Development');
    });

    it('should trim whitespace from title', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '  Python Data Analysis  ' } }],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Analyze data',
        accessToken: 'test-token',
      });

      expect(title).toBe('Python Data Analysis');
    });

    it('should handle Japanese messages', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'React Component Implementation' } }],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Reactコンポーネントを作成してください',
        accessToken: 'test-token',
      });

      expect(title).toBe('React Component Implementation');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Reactコンポーネントを作成してください'),
            }),
          ]),
        })
      );
    });

    it('should return fallback when cleaned title is empty', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '""' } }],
      });

      const title = await service.generateTitle({
        firstSessionMessage: 'Test',
        accessToken: 'test-token',
      });

      expect(title).toBe('General coding session');
    });
  });
});
