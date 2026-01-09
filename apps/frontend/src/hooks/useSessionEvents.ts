import { useState, useEffect, useCallback, useRef } from 'react';
import type { WsSessionEvent, SessionEventData } from '@repo/types';
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

export function useSessionEvents({ sessionId }: UseSessionEventsOptions): UseSessionEventsReturn {
  const [events, setEvents] = useState<SessionEventData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastSeqRef = useRef<number>(0);

  // 過去イベントの取得
  const loadPastEvents = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await sessionService.getSessionEvents(sessionId);
      setEvents(response.data);

      if (response.data.length > 0) {
        lastSeqRef.current = response.data[response.data.length - 1].seq;
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load events'));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // WebSocket イベントハンドラ
  const handleEvent = useCallback((event: WsSessionEvent) => {
    // 重複チェック（seq ベース）
    if (event.seq <= lastSeqRef.current) return;

    lastSeqRef.current = event.seq;

    const eventData: SessionEventData = {
      seq: event.seq,
      uuid: event.uuid,
      type: event.type,
      subtype: event.subtype,
      message: event.message,
      created_at: event.created_at,
    };

    setEvents(prev => [...prev, eventData]);
  }, []);

  // WebSocket 接続成功時のハンドラ
  const handleConnected = useCallback(
    (msg: { last_seq: number }) => {
      // 接続時に last_seq を確認
      if (msg.last_seq > lastSeqRef.current) {
        // 抜けがある可能性があるので再取得
        loadPastEvents();
      }
    },
    [loadPastEvents]
  );

  // WebSocket 接続
  const { isConnected, error: wsError } = useSessionWebSocket({
    sessionId,
    onEvent: handleEvent,
    onConnected: handleConnected,
  });

  // セッション ID が変わったら過去イベントを取得
  useEffect(() => {
    if (sessionId) {
      lastSeqRef.current = 0;
      setEvents([]);
      loadPastEvents();
    }
  }, [sessionId, loadPastEvents]);

  return {
    events,
    isLoading,
    isConnected,
    error: error || wsError,
  };
}
