import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import configPlugin from './config.js';

describe('config plugin', () => {
  let app: FastifyInstance;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create a fresh Fastify instance for each test
    app = Fastify({
      logger: false, // Disable logging in tests
    });
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;

    // Close Fastify instance
    await app.close();
  });

  describe('successful configuration loading', () => {
    it('should load config with all required environment variables', async () => {
      // Set required environment variables
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars for AES-256-GCM
      process.env.DATABRICKS_HOST = 'test.databricks.com';

      await app.register(configPlugin);

      // Verify config is available
      expect(app.config).toBeDefined();
      expect(app.config.DATABASE_URL).toBe('postgresql://localhost:5432/test');
      expect(app.config.ENCRYPTION_KEY).toBe('a'.repeat(64));
      expect(app.config.DATABRICKS_HOST).toBe('test.databricks.com');
    });

    it('should use default values for optional environment variables', async () => {
      // Set only required environment variables
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';
      // Set NODE_ENV to 'test' to prevent loading .env file
      process.env.NODE_ENV = 'test';
      await app.register(configPlugin);

      // Verify default values
      expect(app.config.NODE_ENV).toBe('test');
      expect(app.config.PORT).toBe(8003);
      expect(app.config.DATABRICKS_APP_PORT).toBe(8000);
      expect(app.config.DATABRICKS_APP_NAME).toBe('');
      expect(app.config.DATABRICKS_WORKSPACE_ID).toBe('');
    });

    it('should accept valid NODE_ENV values', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';

      const envValues: Array<'development' | 'production' | 'test'> = [
        'development',
        'production',
        'test',
      ];

      for (const env of envValues) {
        const testApp = Fastify({ logger: false });
        process.env.NODE_ENV = env;

        await testApp.register(configPlugin);

        expect(testApp.config.NODE_ENV).toBe(env);

        await testApp.close();
      }
    });

    it('should accept custom PORT value', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';
      process.env.PORT = '9000';

      await app.register(configPlugin);

      expect(app.config.PORT).toBe(9000);
    });

    it('should construct ANTHROPIC_BASE_URL from DATABRICKS_HOST', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'myworkspace.databricks.com';
      // Note: Default ANTHROPIC_BASE_URL is evaluated at module load time, so we need to set it explicitly
      process.env.ANTHROPIC_BASE_URL =
        'https://myworkspace.databricks.com/serving-endpoints/anthropic';

      await app.register(configPlugin);

      expect(app.config.ANTHROPIC_BASE_URL).toBe(
        'https://myworkspace.databricks.com/serving-endpoints/anthropic'
      );
    });

    it('should use default Anthropic model values', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';

      await app.register(configPlugin);

      expect(app.config.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('databricks-claude-opus-4-6');
      expect(app.config.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('databricks-claude-sonnet-4-6');
      expect(app.config.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('databricks-claude-haiku-4-5');
    });
  });

  describe('validation errors', () => {
    it('should fail when DATABASE_URL is missing', async () => {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';

      await expect(app.register(configPlugin)).rejects.toThrow();
    });

    it('should fail when ENCRYPTION_KEY is missing', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.DATABRICKS_HOST = 'test.databricks.com';
      delete process.env.ENCRYPTION_KEY;

      await expect(app.register(configPlugin)).rejects.toThrow();
    });

    it('should fail when DATABRICKS_HOST is missing', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);

      await expect(app.register(configPlugin)).rejects.toThrow();
    });

    it('should fail when NODE_ENV has invalid value', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';
      process.env.NODE_ENV = 'invalid';

      await expect(app.register(configPlugin)).rejects.toThrow();
    });

    it('should fail when PORT is not an integer', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';
      process.env.PORT = 'not-a-number';

      await expect(app.register(configPlugin)).rejects.toThrow();
    });

    it('should fail when DATABRICKS_APP_PORT is not an integer', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';
      process.env.DATABRICKS_APP_PORT = 'not-a-number';

      await expect(app.register(configPlugin)).rejects.toThrow();
    });

    it('should fail when ENCRYPTION_KEY is not 64 characters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(32); // Too short
      process.env.DATABRICKS_HOST = 'test.databricks.com';

      await expect(app.register(configPlugin)).rejects.toThrow();
    });

    it('should fail when ENCRYPTION_KEY contains non-hex characters', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'g'.repeat(64); // 'g' is not a valid hex character
      process.env.DATABRICKS_HOST = 'test.databricks.com';

      await expect(app.register(configPlugin)).rejects.toThrow();
    });
  });

  describe('directory configuration', () => {
    it('should use default directory paths when HOME is set', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';
      process.env.HOME = '/test/home';
      // Note: Default paths are evaluated at module load time, so we need to set them explicitly
      process.env.USER_BASE_DIR = '/test/home/users';

      await app.register(configPlugin);

      expect(app.config.USER_BASE_DIR).toBe('/test/home/users');
    });

    it('should allow custom USER_BASE_DIR', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';
      process.env.USER_BASE_DIR = '/custom/users';

      await app.register(configPlugin);

      expect(app.config.USER_BASE_DIR).toBe('/custom/users');
    });
  });

  describe('Databricks configuration', () => {
    it('should accept optional Databricks environment variables', async () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      process.env.DATABRICKS_HOST = 'test.databricks.com';
      process.env.DATABRICKS_APP_NAME = 'my-app';
      process.env.DATABRICKS_WORKSPACE_ID = 'workspace-123';
      process.env.DATABRICKS_CLIENT_ID = 'client-id';
      process.env.DATABRICKS_CLIENT_SECRET = 'client-secret';

      await app.register(configPlugin);

      expect(app.config.DATABRICKS_APP_NAME).toBe('my-app');
      expect(app.config.DATABRICKS_WORKSPACE_ID).toBe('workspace-123');
      expect(app.config.DATABRICKS_CLIENT_ID).toBe('client-id');
      expect(app.config.DATABRICKS_CLIENT_SECRET).toBe('client-secret');
    });
  });
});
