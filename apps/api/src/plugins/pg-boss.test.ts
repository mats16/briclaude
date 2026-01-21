import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

// Mock functions need to be defined before vi.mock
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockOn = vi.fn();

vi.mock('pg-boss', () => {
  return {
    PgBoss: class MockPgBoss {
      start = mockStart;
      stop = mockStop;
      on = mockOn;
    },
  };
});

// Import after mocking
import pgBossPlugin from './pg-boss.js';

// Mock config plugin to satisfy dependency
const mockConfigPlugin = fp(
  async (fastify: FastifyInstance) => {
    fastify.decorate('config', {
      DATABASE_URL: 'postgresql://localhost:5432/test',
    } as FastifyInstance['config']);
  },
  { name: 'config' }
);

describe('pg-boss plugin', () => {
  let fastify: FastifyInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
    fastify = Fastify({ logger: false });
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should start pg-boss', async () => {
    await fastify.register(mockConfigPlugin);
    await fastify.register(pgBossPlugin);
    await fastify.ready();

    expect(mockStart).toHaveBeenCalled();
  });

  it('should register error handler', async () => {
    await fastify.register(mockConfigPlugin);
    await fastify.register(pgBossPlugin);
    await fastify.ready();

    expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should decorate fastify with boss instance', async () => {
    await fastify.register(mockConfigPlugin);
    await fastify.register(pgBossPlugin);
    await fastify.ready();

    expect(fastify.boss).toBeDefined();
    expect(fastify.boss.start).toBe(mockStart);
    expect(fastify.boss.stop).toBe(mockStop);
  });

  it('should stop pg-boss gracefully on close', async () => {
    await fastify.register(mockConfigPlugin);
    await fastify.register(pgBossPlugin);
    await fastify.ready();

    await fastify.close();

    expect(mockStop).toHaveBeenCalledWith({
      graceful: true,
      timeout: 30000,
    });
  });

  it('should throw error when pg-boss fails to start', async () => {
    const startError = new Error('Connection failed');
    mockStart.mockRejectedValueOnce(startError);

    await fastify.register(mockConfigPlugin);

    await expect(async () => {
      await fastify.register(pgBossPlugin);
      await fastify.ready();
    }).rejects.toThrow('Connection failed');
  });

  it('should call error handler when error event is emitted', async () => {
    await fastify.register(mockConfigPlugin);
    await fastify.register(pgBossPlugin);
    await fastify.ready();

    // Get the error handler that was registered
    const errorHandler = mockOn.mock.calls.find(call => call[0] === 'error')?.[1];
    expect(errorHandler).toBeDefined();

    // Mock log.error to verify it gets called
    const logErrorSpy = vi.spyOn(fastify.log, 'error');

    // Simulate error event
    const testError = new Error('Test pg-boss error');
    errorHandler(testError);

    expect(logErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ error: testError }),
      'pg-boss error'
    );
  });
});
