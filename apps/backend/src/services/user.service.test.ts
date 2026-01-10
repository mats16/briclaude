import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getOrCreateUser } from './user.service.js';

describe('user.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock Fastify instance
  const createMockFastify = (existingUser: boolean = false): FastifyInstance => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockLimit = vi
      .fn()
      .mockResolvedValue(
        existingUser ? [{ id: 'user-123', name: 'Test User', email: 'test@example.com' }] : []
      );

    const mockInsert = vi.fn().mockReturnThis();
    const mockValues = vi.fn().mockReturnThis();
    const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);

    const mockExecute = vi.fn().mockResolvedValue(undefined);

    const mockTransaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        execute: mockExecute,
        insert: mockInsert,
        values: mockValues,
        onConflictDoNothing: mockOnConflictDoNothing,
      };

      // Chain methods correctly
      mockInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: mockOnConflictDoNothing,
        }),
      });

      return callback(mockTx);
    });

    return {
      db: {
        select: mockSelect,
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: mockLimit,
          }),
        }),
        transaction: mockTransaction,
      },
    } as unknown as FastifyInstance;
  };

  describe('getOrCreateUser', () => {
    it('should return existing user without creating new one', async () => {
      const fastify = createMockFastify(true);
      const userInfo = { id: 'user-123', name: 'Test User', email: 'test@example.com' };

      const result = await getOrCreateUser(fastify, userInfo);

      expect(result).toEqual(userInfo);
      expect(fastify.db.transaction).not.toHaveBeenCalled();
    });

    it('should create new user when not exists', async () => {
      const fastify = createMockFastify(false);
      const userInfo = { id: 'new-user-456', name: 'New User', email: 'new@example.com' };

      const result = await getOrCreateUser(fastify, userInfo);

      expect(result).toEqual(userInfo);
      expect(fastify.db.transaction).toHaveBeenCalled();
    });

    it('should execute RLS context setting in transaction', async () => {
      let executeCalled = false;
      let executeArg: unknown = null;

      const mockTransaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          execute: vi.fn((arg: unknown) => {
            executeCalled = true;
            executeArg = arg;
            return Promise.resolve(undefined);
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        return callback(mockTx);
      });

      const fastify = {
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
          transaction: mockTransaction,
        },
      } as unknown as FastifyInstance;

      await getOrCreateUser(fastify, { id: 'user-123', name: 'Test', email: 'test@test.com' });

      expect(executeCalled).toBe(true);
      // The execute should be called with SQL template for set_config
      expect(executeArg).toBeDefined();
    });

    it('should insert into users table', async () => {
      let insertCalled = false;

      const mockTransaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          execute: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn(() => {
            insertCalled = true;
            return {
              values: vi.fn().mockReturnValue({
                onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
              }),
            };
          }),
        };
        return callback(mockTx);
      });

      const fastify = {
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
          transaction: mockTransaction,
        },
      } as unknown as FastifyInstance;

      await getOrCreateUser(fastify, { id: 'user-123', name: 'Test', email: 'test@test.com' });

      // Transaction should be called and insert should happen
      expect(mockTransaction).toHaveBeenCalled();
      expect(insertCalled).toBe(true);
    });

    it('should insert into user_settings table', async () => {
      let insertCount = 0;

      const mockTransaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          execute: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn(() => {
            insertCount++;
            return {
              values: vi.fn().mockReturnValue({
                onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
              }),
            };
          }),
        };
        return callback(mockTx);
      });

      const fastify = {
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
          transaction: mockTransaction,
        },
      } as unknown as FastifyInstance;

      await getOrCreateUser(fastify, { id: 'user-123', name: 'Test', email: 'test@test.com' });

      // Should have 2 insert calls (users and user_settings)
      expect(insertCount).toBe(2);
    });

    it('should use onConflictDoNothing for race condition handling', async () => {
      const onConflictCalls: number[] = [];

      const mockTransaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          execute: vi.fn().mockResolvedValue(undefined),
          insert: vi.fn(() => ({
            values: vi.fn().mockReturnValue({
              onConflictDoNothing: vi.fn(() => {
                onConflictCalls.push(1);
                return Promise.resolve(undefined);
              }),
            }),
          })),
        };
        return callback(mockTx);
      });

      const fastify = {
        db: {
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
          transaction: mockTransaction,
        },
      } as unknown as FastifyInstance;

      await getOrCreateUser(fastify, { id: 'user-123', name: 'Test', email: 'test@test.com' });

      // Both inserts should use onConflictDoNothing
      expect(onConflictCalls.length).toBe(2);
    });

    it('should return user info regardless of creation', async () => {
      // Test with existing user
      const existingFastify = createMockFastify(true);
      const userInfo = { id: 'user-123', name: 'Test User', email: 'test@example.com' };

      const existingResult = await getOrCreateUser(existingFastify, userInfo);
      expect(existingResult).toEqual(userInfo);

      // Test with new user
      const newFastify = createMockFastify(false);
      const newResult = await getOrCreateUser(newFastify, userInfo);
      expect(newResult).toEqual(userInfo);
    });
  });
});
