import { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionEventData } from '@repo/types';
import { sessionService } from '@/services/session.service';
import { useSessionWebSocket } from './useSessionWebSocket';

interface UseSessionEventsOptions {
  sessionId: string | null;
}

interface UseSessionEventsReturn {
  events: SessionEventData[];
  isLoading: boolean;
  isConnected: boolean;
  error: Error | null;
}

export function useSessionEvents({
  sessionId,
}: UseSessionEventsOptions): UseSessionEventsReturn {
  const [events, setEvents] = useState<SessionEventData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const seenUuidsRef = useRef<Set<string>>(new Set());

  // 過去イベントの取得
  const loadPastEvents = useCallback(async (targetSessionId: string) => {
    if (!targetSessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await sessionService.getSessionEvents(targetSessionId);
      setEvents(response.data);
      seenUuidsRef.current = new Set(response.data.map(e => e.uuid));
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load events'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // WebSocket イベントハンドラ
  const handleEvent = useCallback((event: SessionEventData) => {
    // 重複チェック（uuid ベース）
    if (seenUuidsRef.current.has(event.uuid)) return;
    seenUuidsRef.current.add(event.uuid);

    setEvents(prev => [...prev, event]);
  }, []);

  // WebSocket 接続成功時のハンドラ
  const handleConnected = useCallback((_msg: { last_seq: number }) => {
    // WebSocket 接続成功時はリアルタイム更新を受け取る準備のみ
  }, []);

  // WebSocket 接続
  const { isConnected, error: wsError } = useSessionWebSocket({
    sessionId,
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
    error: error || wsError,
  };
}
