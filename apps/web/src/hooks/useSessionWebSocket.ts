import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  WsServerMessage,
  SDKMessage,
  SDKUserMessage,
  WsConnectedMessage,
  WsControlRequest,
  WsControlResponse,
  UserMessageContentBlock,
} from '@repo/types';
import {
  WEBSOCKET_KEEP_ALIVE_INTERVAL_MS,
  WEBSOCKET_RECONNECT_BASE_DELAY_MS,
  WEBSOCKET_RECONNECT_MAX_DELAY_MS,
} from '@/constants';

interface UseSessionWebSocketOptions {
  sessionId: string | null;
  autoConnect?: boolean;
  onEvent?: (event: SDKMessage) => void;
  onConnected?: (message: WsConnectedMessage) => void;
  onError?: (error: Error) => void;
}

interface UseSessionWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  reconnect: () => void;
  connect: () => void;
  sendMessage: (content: UserMessageContentBlock[]) => void;
  abort: () => Promise<boolean>;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const CONTROL_REQUEST_TIMEOUT_MS = 10_000;

export function useSessionWebSocket({
  sessionId,
  autoConnect = true,
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
  const pendingMessagesRef = useRef<UserMessageContentBlock[][]>([]);
  const pendingControlRequestsRef = useRef<
    Map<string, { resolve: (success: boolean) => void; reject: (error: Error) => void }>
  >(new Map());

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
    // OPEN または CONNECTING 状態の場合は何もしない
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/sessions/${sessionId}/subscribe`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnecting(false);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data) as WsServerMessage;

        if (message.type === 'connected') {
          setIsConnected(true);

          // ペンディングメッセージを送信（サーバー準備完了後）
          while (pendingMessagesRef.current.length > 0) {
            const content = pendingMessagesRef.current.shift();
            if (content && content.length > 0 && ws.readyState === WebSocket.OPEN) {
              const userMessage: SDKUserMessage = {
                type: 'user',
                uuid: crypto.randomUUID(),
                session_id: sessionId!,
                message: {
                  role: 'user',
                  content,
                },
                parent_tool_use_id: null,
              };
              ws.send(JSON.stringify(userMessage));
            }
          }

          // WsConnectedMessage - ref 経由で最新のコールバックを呼び出す
          onConnectedRef.current?.(message as WsConnectedMessage);
        } else if (message.type === 'error') {
          // WsErrorMessage
          const errorMessage = (message as { message: string }).message;
          setError(new Error(errorMessage));
          onErrorRef.current?.(new Error(errorMessage));
        } else if (message.type === 'control_response') {
          // WsControlResponse - pending リクエストを解決
          const response = message as WsControlResponse;
          const pending = pendingControlRequestsRef.current.get(response.response.request_id);
          if (pending) {
            pendingControlRequestsRef.current.delete(response.response.request_id);
            pending.resolve(response.response.subtype === 'success');
          }
        } else if ('session_id' in message) {
          // SDKMessage - ref 経由で最新のコールバックを呼び出す
          onEventRef.current?.(message as SDKMessage);
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

      // 切断時に pending control requests をクリーンアップ
      pendingControlRequestsRef.current.forEach(pending => {
        pending.reject(new Error('WebSocket disconnected'));
      });
      pendingControlRequestsRef.current.clear();

      // 異常終了時のみ再接続を試みる
      if (!event.wasClean && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        const delay = Math.min(
          WEBSOCKET_RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts.current),
          WEBSOCKET_RECONNECT_MAX_DELAY_MS
        );
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

  // セッション ID が変わったら再接続（autoConnect が有効な場合のみ）
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
      pendingMessagesRef.current = [];
    };
  }, [connect, autoConnect]);

  // keep_alive によるキープアライブ
  useEffect(() => {
    if (!isConnected) return;

    const keepAliveInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'keep_alive' }));
      }
    }, WEBSOCKET_KEEP_ALIVE_INTERVAL_MS);

    return () => clearInterval(keepAliveInterval);
  }, [isConnected]);

  // メッセージ送信関数（未接続の場合は透過的に接続）
  const sendMessage = useCallback(
    (content: UserMessageContentBlock[]) => {
      if (!sessionId) return;

      // 接続済みの場合は直接送信
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const message: SDKUserMessage = {
          type: 'user',
          uuid: crypto.randomUUID(),
          session_id: sessionId,
          message: {
            role: 'user',
            content,
          },
          parent_tool_use_id: null,
        };
        wsRef.current.send(JSON.stringify(message));
        return;
      }

      // 未接続の場合はキューに追加して接続開始
      pendingMessagesRef.current.push(content);
      connect();
    },
    [sessionId, connect]
  );

  // Agent を abort する
  const abort = useCallback(async (): Promise<boolean> => {
    if (!sessionId || wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    const requestId = crypto.randomUUID();
    const request: WsControlRequest = {
      type: 'control_request',
      request_id: requestId,
      request: {
        subtype: 'abort',
      },
    };

    return new Promise<boolean>(resolve => {
      pendingControlRequestsRef.current.set(requestId, {
        resolve,
        reject: () => resolve(false),
      });
      wsRef.current!.send(JSON.stringify(request));

      // タイムアウト
      setTimeout(() => {
        if (pendingControlRequestsRef.current.has(requestId)) {
          pendingControlRequestsRef.current.delete(requestId);
          resolve(false);
        }
      }, CONTROL_REQUEST_TIMEOUT_MS);
    });
  }, [sessionId]);

  return {
    isConnected,
    isConnecting,
    error,
    reconnect,
    connect,
    sendMessage,
    abort,
  };
}
