import { useState, useEffect, useCallback, useRef } from 'react';
import type { SDKMessage, UserMessageContentBlock, SessionStatus } from '@repo/types';
import { sessionService } from '@/services/session.service';
import { useSessionWebSocket } from './useSessionWebSocket';

interface UseSessionEventsOptions {
  sessionId: string | null;
  /** GET /api/sessions/:sessionId から取得した初期 sessionStatus */
  initialSessionStatus?: SessionStatus | null;
}

interface UseSessionEventsReturn {
  events: SDKMessage[];
  isLoading: boolean;
  isConnected: boolean;
  error: Error | null;
  /** WebSocket からの result 受信で更新される session status */
  sessionStatus: SessionStatus | null;
  sendMessage: (content: UserMessageContentBlock[]) => void;
  abort: () => Promise<boolean>;
}

export function useSessionEvents({
  sessionId,
  initialSessionStatus,
}: UseSessionEventsOptions): UseSessionEventsReturn {
  const [events, setEvents] = useState<SDKMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [shouldAutoConnect, setShouldAutoConnect] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const seenUuidsRef = useRef<Set<string>>(new Set());

  // initialSessionStatus が変わったら sessionStatus を更新
  useEffect(() => {
    if (initialSessionStatus !== undefined) {
      setSessionStatus(initialSessionStatus);
    }
  }, [initialSessionStatus]);

  // 過去イベントの取得
  const loadPastEvents = useCallback(
    async (targetSessionId: string) => {
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

        // session_status が init/running の場合のみ自動接続
        // （initialSessionStatus を使って判定）
        const needsWebSocket =
          initialSessionStatus === 'init' || initialSessionStatus === 'running';
        setShouldAutoConnect(needsWebSocket);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Failed to load events'));
      } finally {
        setIsLoading(false);
      }
    },
    [initialSessionStatus]
  );

  // WebSocket イベントハンドラ
  const handleEvent = useCallback((event: SDKMessage) => {
    // 重複チェック（uuid ベース、uuid がない場合はスキップ）
    if ('uuid' in event && event.uuid) {
      const uuid = event.uuid as string;
      if (seenUuidsRef.current.has(uuid)) return;
      seenUuidsRef.current.add(uuid);
    }

    setEvents(prev => [...prev, event]);

    // result イベント受信時に sessionStatus を idle に更新
    if (event.type === 'result') {
      setSessionStatus('idle');
    }
    // init イベント受信時に sessionStatus を running に更新
    if (event.type === 'system' && 'subtype' in event && event.subtype === 'init') {
      setSessionStatus('running');
    }
  }, []);

  // WebSocket 接続成功時のハンドラ
  const handleConnected = useCallback((_msg: { last_event_id: string | null }) => {
    // WebSocket 接続成功時はリアルタイム更新を受け取る準備のみ
  }, []);

  // WebSocket 接続（shouldAutoConnect に基づいて自動接続を制御）
  const { isConnected, sendMessage, abort } = useSessionWebSocket({
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
    sessionStatus,
    sendMessage,
    abort,
  };
}
