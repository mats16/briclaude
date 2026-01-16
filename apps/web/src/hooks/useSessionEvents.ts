import { useState, useEffect, useCallback, useRef } from 'react';
import type { SDKMessage, UserMessageContentBlock } from '@repo/types';
import { isSDKResultMessageEvent } from '@repo/types';
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
  totalCostUsd: number;
  sendMessage: (content: UserMessageContentBlock[]) => void;
  abort: () => Promise<boolean>;
}

export function useSessionEvents({ sessionId }: UseSessionEventsOptions): UseSessionEventsReturn {
  const [events, setEvents] = useState<SDKMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [shouldAutoConnect, setShouldAutoConnect] = useState(false);
  const [totalCostUsd, setTotalCostUsd] = useState<number>(0);
  const seenUuidsRef = useRef<Set<string>>(new Set());

  // 過去イベントの取得
  const loadPastEvents = useCallback(async (targetSessionId: string) => {
    if (!targetSessionId) return;

    setIsLoading(true);
    setError(null);
    setShouldAutoConnect(false);
    setTotalCostUsd(0);

    try {
      // イベントと使用量を並行取得
      const [eventsResponse, usageResponse] = await Promise.all([
        sessionService.getSessionEvents(targetSessionId),
        sessionService.getSessionUsage(targetSessionId),
      ]);

      setEvents(eventsResponse.data);
      // SDKMessage.uuid を使用して seen set を構築（uuid がない場合はスキップ）
      seenUuidsRef.current = new Set(
        eventsResponse.data.filter(e => 'uuid' in e && e.uuid).map(e => e.uuid as string)
      );

      // 使用量から total_cost_usd を設定
      setTotalCostUsd(usageResponse.total_cost_usd);

      // 最後のイベントが result でない場合のみ自動接続
      const lastEvent = eventsResponse.data[eventsResponse.data.length - 1];
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

    // result message から cost を抽出して加算
    if (isSDKResultMessageEvent(event) && event.total_cost_usd !== undefined) {
      setTotalCostUsd(prev => prev + event.total_cost_usd!);
    }

    setEvents(prev => [...prev, event]);
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
    totalCostUsd,
    sendMessage,
    abort,
  };
}
