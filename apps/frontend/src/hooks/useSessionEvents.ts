import { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionEventData } from '@repo/types';
import { sessionService } from '@/services/session.service';
import { useSessionWebSocket } from './useSessionWebSocket';

interface UseSessionEventsOptions {
  sessionId: string | null;
  initialEvents?: SessionEventData[];
}

interface UseSessionEventsReturn {
  events: SessionEventData[];
  isLoading: boolean;
  isConnected: boolean;
  error: Error | null;
}

export function useSessionEvents({
  sessionId,
  initialEvents,
}: UseSessionEventsOptions): UseSessionEventsReturn {
  const [events, setEvents] = useState<SessionEventData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const seenUuidsRef = useRef<Set<string>>(new Set());
  const initialEventsAppliedRef = useRef<string | null>(null);

  // 初期イベントを適用（POST レスポンスから取得した場合）
  useEffect(() => {
    if (
      sessionId &&
      initialEvents &&
      initialEvents.length > 0 &&
      initialEventsAppliedRef.current !== sessionId
    ) {
      initialEventsAppliedRef.current = sessionId;
      setEvents(initialEvents);
      seenUuidsRef.current = new Set(initialEvents.map(e => e.uuid));
    }
  }, [sessionId, initialEvents]);

  // 過去イベントの取得
  const loadPastEvents = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await sessionService.getSessionEvents(sessionId);
      setEvents(response.data);

      // 既知の uuid を記録
      seenUuidsRef.current = new Set(response.data.map(e => e.uuid));
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load events'));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // WebSocket イベントハンドラ
  const handleEvent = useCallback((event: SessionEventData) => {
    // 重複チェック（uuid ベース）
    if (seenUuidsRef.current.has(event.uuid)) return;
    seenUuidsRef.current.add(event.uuid);

    setEvents(prev => [...prev, event]);
  }, []);

  // WebSocket 接続成功時のハンドラ
  const handleConnected = useCallback(
    (_msg: { last_seq: number }) => {
      // initialEvents がある場合は過去イベント取得をスキップ
      if (initialEventsAppliedRef.current === sessionId) {
        return;
      }
      loadPastEvents();
    },
    [loadPastEvents, sessionId]
  );

  // WebSocket 接続
  const { isConnected, error: wsError } = useSessionWebSocket({
    sessionId,
    onEvent: handleEvent,
    onConnected: handleConnected,
  });

  // セッション ID が変わったら状態をリセット
  // initialEvents がない場合のみ過去イベントを取得
  useEffect(() => {
    if (sessionId) {
      // initialEvents がある場合はリセットしない（初期イベント用 useEffect で処理）
      if (initialEvents && initialEvents.length > 0) {
        return;
      }
      setEvents([]);
      seenUuidsRef.current.clear();
      initialEventsAppliedRef.current = null;
      loadPastEvents();
    }
  }, [sessionId, initialEvents, loadPastEvents]);

  return {
    events,
    isLoading,
    isConnected,
    error: error || wsError,
  };
}
