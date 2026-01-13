// apps/api/src/plugins/database.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import configPlugin from './config.js';
import databasePlugin, { RLSContextError } from './database.js';

describe('database plugin', () => {
  let app: FastifyInstance;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set required environment variables for config plugin
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test_db';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.DATABRICKS_HOST = 'test.databricks.com';

    // Create a fresh Fastify instance for each test
    app = Fastify({
      logger: false, // Disable logging in tests
    });
  });

  afterEach(async () => {
    // Restore original environment
    process.env = originalEnv;

    // Close Fastify instance (will trigger onClose hook)
    await app.close();
  });

  describe('successful initialization', () => {
    it('should initialize database connection and decorate fastify.db', async () => {
      // Register config plugin first (dependency)
      await app.register(configPlugin);

      // Register database plugin
      await app.register(databasePlugin);

      // Verify db is decorated
      expect(app.db).toBeDefined();
      expect(typeof app.db).toBe('object');
    });

    it('should have access to schema through fastify.db', async () => {
      await app.register(configPlugin);
      await app.register(databasePlugin);

      // Verify schema is accessible
      expect(app.db).toBeDefined();

      // TypeScript should allow querying
      // (実際のクエリはテストDB接続が必要なため、型チェックのみ)
      expect(typeof app.db.query).toBe('object');
    });

    it('should close database connection on app close', async () => {
      await app.register(configPlugin);
      await app.register(databasePlugin);

      // Verify db is available
      expect(app.db).toBeDefined();

      // Close app (should trigger onClose hook)
      await app.close();

      // After close, creating a new instance should still work
      const app2 = Fastify({ logger: false });
      await app2.register(configPlugin);
      await app2.register(databasePlugin);

      expect(app2.db).toBeDefined();

      await app2.close();
    });
  });

  describe('validation errors', () => {
    it('should fail when config plugin is not registered (missing dependency)', async () => {
      // Try to register database plugin without config plugin
      await expect(app.register(databasePlugin)).rejects.toThrow();
    });

    it('should fail when DATABASE_URL is invalid', async () => {
      process.env.DATABASE_URL = 'invalid-url';

      await app.register(configPlugin);

      // database plugin should fail with invalid connection string
      await expect(app.register(databasePlugin)).rejects.toThrow();
    });
  });

  describe('database operations', () => {
    it('should support basic query structure (type check)', async () => {
      await app.register(configPlugin);
      await app.register(databasePlugin);

      // Verify database instance is available
      expect(app.db).toBeDefined();
      expect(typeof app.db).toBe('object');

      // Verify basic Drizzle ORM methods are available
      expect(typeof app.db.select).toBe('function');
      expect(typeof app.db.insert).toBe('function');
      expect(typeof app.db.update).toBe('function');
      expect(typeof app.db.delete).toBe('function');
    });
  });

  describe('withUserContext', () => {
    it('should decorate fastify.withUserContext', async () => {
      await app.register(configPlugin);
      await app.register(databasePlugin);

      expect(app.withUserContext).toBeDefined();
      expect(typeof app.withUserContext).toBe('function');
    });

    it('should throw RLSContextError for empty userId', async () => {
      await app.register(configPlugin);
      await app.register(databasePlugin);

      await expect(app.withUserContext('', async () => {})).rejects.toThrow(RLSContextError);
      await expect(app.withUserContext('', async () => {})).rejects.toThrow(
        'must be a non-empty string'
      );
    });

    it('should throw RLSContextError for whitespace-only userId', async () => {
      await app.register(configPlugin);
      await app.register(databasePlugin);

      await expect(app.withUserContext('   ', async () => {})).rejects.toThrow(RLSContextError);
      await expect(app.withUserContext('   ', async () => {})).rejects.toThrow(
        'cannot be empty or whitespace only'
      );
    });

    it('should throw RLSContextError for null/undefined userId', async () => {
      await app.register(configPlugin);
      await app.register(databasePlugin);

      // @ts-expect-error - Testing runtime behavior with invalid input
      await expect(app.withUserContext(null, async () => {})).rejects.toThrow(RLSContextError);
      // @ts-expect-error - Testing runtime behavior with invalid input
      await expect(app.withUserContext(undefined, async () => {})).rejects.toThrow(RLSContextError);
    });

    it('RLSContextError should include userId in error', async () => {
      await app.register(configPlugin);
      await app.register(databasePlugin);

      try {
        await app.withUserContext('   ', async () => {});
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(RLSContextError);
        expect((error as RLSContextError).userId).toBe('   ');
      }
    });
  });
});
