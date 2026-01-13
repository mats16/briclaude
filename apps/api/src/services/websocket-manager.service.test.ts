import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocket } from 'ws';

// Re-import wsManager fresh for each test by resetting modules
let wsManager: typeof import('./websocket-manager.service.js').wsManager;

describe('WebSocketManager', () => {
  // Helper to create mock WebSocket
  const createMockWebSocket = (readyState = 1): WebSocket => {
    const eventHandlers = new Map<string, (...args: unknown[]) => void>();
    return {
      readyState,
      OPEN: 1,
      CLOSED: 3,
      send: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        eventHandlers.set(event, handler);
      }),
      // Helper to trigger events in tests
      _triggerEvent: (event: string, ...args: unknown[]) => {
        const handler = eventHandlers.get(event);
        if (handler) handler(...args);
      },
    } as unknown as WebSocket & { _triggerEvent: (event: string, ...args: unknown[]) => void };
  };

  beforeEach(async () => {
    // Reset modules to get fresh singleton
    vi.resetModules();
    const module = await import('./websocket-manager.service.js');
    wsManager = module.wsManager;
  });

  describe('addConnection', () => {
    it('should add connection to session', () => {
      const ws = createMockWebSocket();
      const sessionId = 'session-123';
      const userId = 'user-456';

      wsManager.addConnection(sessionId, userId, ws);

      expect(wsManager.getConnectionCount(sessionId)).toBe(1);
    });

    it('should create new Set for new sessionId', () => {
      const ws = createMockWebSocket();

      wsManager.addConnection('new-session', 'user-1', ws);

      expect(wsManager.getConnectionCount('new-session')).toBe(1);
    });

    it('should add multiple connections to same session', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const sessionId = 'session-multi';

      wsManager.addConnection(sessionId, 'user-1', ws1);
      wsManager.addConnection(sessionId, 'user-2', ws2);

      expect(wsManager.getConnectionCount(sessionId)).toBe(2);
    });

    it('should register close handler', () => {
      const ws = createMockWebSocket();

      wsManager.addConnection('session-1', 'user-1', ws);

      expect(ws.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should remove connection on close', () => {
      const ws = createMockWebSocket() as WebSocket & {
        _triggerEvent: (event: string, ...args: unknown[]) => void;
      };

      wsManager.addConnection('session-close', 'user-1', ws);
      expect(wsManager.getConnectionCount('session-close')).toBe(1);

      // Trigger close event
      ws._triggerEvent('close');

      expect(wsManager.getConnectionCount('session-close')).toBe(0);
    });

    it('should delete session when last connection closes', () => {
      const ws = createMockWebSocket() as WebSocket & {
        _triggerEvent: (event: string, ...args: unknown[]) => void;
      };

      wsManager.addConnection('session-last', 'user-1', ws);
      ws._triggerEvent('close');

      // Session should be removed entirely
      expect(wsManager.getConnectionCount('session-last')).toBe(0);
    });

    it('should keep session when other connections remain', () => {
      const ws1 = createMockWebSocket() as WebSocket & {
        _triggerEvent: (event: string, ...args: unknown[]) => void;
      };
      const ws2 = createMockWebSocket();
      const sessionId = 'session-keep';

      wsManager.addConnection(sessionId, 'user-1', ws1);
      wsManager.addConnection(sessionId, 'user-2', ws2);
      expect(wsManager.getConnectionCount(sessionId)).toBe(2);

      // Close first connection
      ws1._triggerEvent('close');

      expect(wsManager.getConnectionCount(sessionId)).toBe(1);
    });
  });

  describe('broadcast', () => {
    it('should send message to all connections in session', () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      const sessionId = 'session-broadcast';
      const message = { type: 'test', data: 'hello' };

      wsManager.addConnection(sessionId, 'user-1', ws1);
      wsManager.addConnection(sessionId, 'user-2', ws2);

      wsManager.broadcast(sessionId, message as never);

      expect(ws1.send).toHaveBeenCalledWith(JSON.stringify(message));
      expect(ws2.send).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should not send to closed connections', () => {
      const wsOpen = createMockWebSocket(1); // OPEN
      const wsClosed = createMockWebSocket(3); // CLOSED
      const sessionId = 'session-mixed';

      wsManager.addConnection(sessionId, 'user-1', wsOpen);
      wsManager.addConnection(sessionId, 'user-2', wsClosed);

      wsManager.broadcast(sessionId, { type: 'test' } as never);

      expect(wsOpen.send).toHaveBeenCalled();
      expect(wsClosed.send).not.toHaveBeenCalled();
    });

    it('should do nothing if session has no connections', () => {
      // Should not throw
      expect(() => {
        wsManager.broadcast('non-existent-session', { type: 'test' } as never);
      }).not.toThrow();
    });

    it('should serialize message as JSON', () => {
      const ws = createMockWebSocket();
      const sessionId = 'session-json';
      const complexMessage = {
        type: 'system',
        subtype: 'init',
        data: { nested: { value: 123 } },
      };

      wsManager.addConnection(sessionId, 'user-1', ws);
      wsManager.broadcast(sessionId, complexMessage as never);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify(complexMessage));
    });
  });

  describe('getConnectionCount', () => {
    it('should return 0 for unknown session', () => {
      expect(wsManager.getConnectionCount('unknown-session')).toBe(0);
    });

    it('should return correct count for session with connections', () => {
      const sessionId = 'session-count';

      wsManager.addConnection(sessionId, 'user-1', createMockWebSocket());
      wsManager.addConnection(sessionId, 'user-2', createMockWebSocket());
      wsManager.addConnection(sessionId, 'user-3', createMockWebSocket());

      expect(wsManager.getConnectionCount(sessionId)).toBe(3);
    });

    it('should return 0 after all connections close', () => {
      const ws = createMockWebSocket() as WebSocket & {
        _triggerEvent: (event: string, ...args: unknown[]) => void;
      };
      const sessionId = 'session-all-closed';

      wsManager.addConnection(sessionId, 'user-1', ws);
      ws._triggerEvent('close');

      expect(wsManager.getConnectionCount(sessionId)).toBe(0);
    });
  });
});
