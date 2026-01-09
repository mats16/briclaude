import { useState, useEffect, useRef, useCallback } from 'react';
import type { WsServerMessage, SessionEventData, WsConnectedMessage } from '@repo/types';

interface UseSessionWebSocketOptions {
  sessionId: string | null;
  onEvent?: (event: SessionEventData) => void;
  onConnected?: (message: WsConnectedMessage) => void;
  onError?: (error: Error) => void;
}

interface UseSessionWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnect: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;

export function useSessionWebSocket({
  sessionId,
  onEvent,
  onConnected,
  onError,
}: UseSessionWebSocketOptions): UseSessionWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  // stale closure 問題を回避するため、コールバックを ref で保持
  const onEventRef = useRef(onEvent);
  const onConnectedRef = useRef(onConnected);
  const onErrorRef = useRef(onError);

  // 毎レンダリングで ref を更新
  onEventRef.current = onEvent;
  onConnectedRef.current = onConnected;
  onErrorRef.current = onError;

  const connect = useCallback(() => {
    if (!sessionId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    setError(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/sessions/${sessionId}/subscribe`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      setIsConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as WsServerMessage;

        if ('session_id' in message && message.type === 'connected') {
          // WsConnectedMessage - ref 経由で最新のコールバックを呼び出す
          onConnectedRef.current?.(message as WsConnectedMessage);
        } else if ('code' in message && message.type === 'error') {
          // WsErrorMessage
          const errorMessage = (message as { message: string }).message;
          setError(new Error(errorMessage));
          onErrorRef.current?.(new Error(errorMessage));
        } else if (message.type === 'pong') {
          // Pong message - ignore
        } else if ('uuid' in message && 'data' in message) {
          // SessionEventData - ref 経由で最新のコールバックを呼び出す
          onEventRef.current?.(message as SessionEventData);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = () => {
      setError(new Error('WebSocket connection error'));
    };

    ws.onclose = event => {
      setIsConnected(false);
      setIsConnecting(false);
      wsRef.current = null;

      // 異常終了時のみ再接続を試みる
      if (!event.wasClean && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };
  }, [sessionId]); // コールバックは ref 経由で参照するため依存配列から削除

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    wsRef.current?.close();
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  // セッション ID が変わったら再接続
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  // Ping/Pong によるキープアライブ
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  return {
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
}
