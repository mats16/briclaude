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

  // 過去イベントの取得（sessionId を引数として受け取る）
  const loadPastEvents = useCallback(async (targetSessionId: string) => {
    console.log('[loadPastEvents] Called with', { targetSessionId });
    if (!targetSessionId) {
      console.log('[loadPastEvents] Early return - no sessionId');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[loadPastEvents] Calling API');
      const response = await sessionService.getSessionEvents(targetSessionId);
      console.log('[loadPastEvents] API response', { eventCount: response.data.length });
      setEvents(response.data);

      // 既知の uuid を記録
      seenUuidsRef.current = new Set(response.data.map(e => e.uuid));
      // 取得完了をマーク
      initialEventsAppliedRef.current = targetSessionId;
    } catch (e) {
      console.error('[loadPastEvents] API error', e);
      setError(e instanceof Error ? e : new Error('Failed to load events'));
    } finally {
      setIsLoading(false);
    }
  }, []); // 依存配列を空にして関数の参照を安定化

  // WebSocket イベントハンドラ
  const handleEvent = useCallback((event: SessionEventData) => {
    // 重複チェック（uuid ベース）
    if (seenUuidsRef.current.has(event.uuid)) return;
    seenUuidsRef.current.add(event.uuid);

    setEvents(prev => [...prev, event]);
  }, []);

  // WebSocket 接続成功時のハンドラ
  // 過去イベント取得は useEffect で行うため、ここでは何もしない
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
  // WebSocket から分離し、直接 API を呼び出す
  useEffect(() => {
    console.log('[useSessionEvents] useEffect fired', {
      sessionId,
      hasInitialEvents: initialEvents && initialEvents.length > 0,
    });
    if (sessionId) {
      // initialEvents がある場合はスキップ（初期イベント用 useEffect で処理）
      if (initialEvents && initialEvents.length > 0) {
        console.log('[useSessionEvents] Skipping loadPastEvents (initialEvents exists)');
        return;
      }
      // 既存セッションを開いた場合は過去イベントを取得
      console.log('[useSessionEvents] Calling loadPastEvents', { sessionId });
      setEvents([]);
      seenUuidsRef.current.clear();
      initialEventsAppliedRef.current = null;
      loadPastEvents(sessionId);
    }
  }, [sessionId, initialEvents, loadPastEvents]);

  return {
    events,
    isLoading,
    isConnected,
    error: error || wsError,
  };
}
