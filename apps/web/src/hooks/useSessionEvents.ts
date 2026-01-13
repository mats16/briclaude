import { useState, useEffect, useCallback, useRef } from 'react';
import type { SDKMessage } from '@repo/types';
import { sessionService } from '@/services/session.service';
import { useSessionWebSocket } from './useSessionWebSocket';

interface UseSessionEventsOptions {
  sessionId: string | null;
}

interface UseSessionEventsReturn {
  events: SDKMessage[];
  isLoading: boolean;
  isConnected: boolean;
  error: Error | null;
  sendMessage: (content: string) => void;
}

export function useSessionEvents({ sessionId }: UseSessionEventsOptions): UseSessionEventsReturn {
  const [events, setEvents] = useState<SDKMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [shouldAutoConnect, setShouldAutoConnect] = useState(false);
  const seenUuidsRef = useRef<Set<string>>(new Set());

  // 過去イベントの取得
  const loadPastEvents = useCallback(async (targetSessionId: string) => {
    if (!targetSessionId) return;

    setIsLoading(true);
    setError(null);
    setShouldAutoConnect(false);

    try {
      const response = await sessionService.getSessionEvents(targetSessionId);
      setEvents(response.data);
      // SDKMessage.uuid を使用して seen set を構築（uuid がない場合はスキップ）
      seenUuidsRef.current = new Set(
        response.data.filter(e => 'uuid' in e && e.uuid).map(e => e.uuid as string)
      );

      // 最後のイベントが result でない場合のみ自動接続
      const lastEvent = response.data[response.data.length - 1];
      const isSessionComplete =
        lastEvent && 'type' in lastEvent && (lastEvent as { type: string }).type === 'result';
      setShouldAutoConnect(!isSessionComplete);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load events'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // WebSocket イベントハンドラ
  const handleEvent = useCallback((event: SDKMessage) => {
    // 重複チェック（uuid ベース、uuid がない場合はスキップ）
    if ('uuid' in event && event.uuid) {
      const uuid = event.uuid as string;
      if (seenUuidsRef.current.has(uuid)) return;
      seenUuidsRef.current.add(uuid);
    }

    setEvents(prev => [...prev, event]);
  }, []);

  // WebSocket 接続成功時のハンドラ
  const handleConnected = useCallback((_msg: { last_event_id: string | null }) => {
    // WebSocket 接続成功時はリアルタイム更新を受け取る準備のみ
  }, []);

  // WebSocket 接続（shouldAutoConnect に基づいて自動接続を制御）
  const { isConnected, sendMessage } = useSessionWebSocket({
    sessionId,
    autoConnect: shouldAutoConnect,
    onEvent: handleEvent,
    onConnected: handleConnected,
  });

  // セッション ID が変わったら過去イベントを取得
  useEffect(() => {
    if (sessionId) {
      setEvents([]);
      seenUuidsRef.current.clear();
      loadPastEvents(sessionId);
    }
  }, [sessionId, loadPastEvents]);

  return {
    events,
    isLoading,
    isConnected,
    error,
    sendMessage,
  };
}
