import { useEffect, useMemo, useRef, useCallback } from 'react';
import type { SDKMessage } from '@repo/types';
import { EventItem } from './EventItem';
import { ThinkingIndicator } from './ThinkingIndicator';
import { LoadingScreen } from '@/components/ui/loading-spinner';
import { extractToolResults, groupChildEvents } from '@/lib/message-utils';
import { cn, throttle } from '@/lib/utils';

interface MessageAreaProps {
  events: SDKMessage[];
  isLoading?: boolean;
  error?: Error | null;
  isAgentThinking?: boolean;
  hasFloatingButton?: boolean;
}

// ユーザーが最下部付近にいるかどうかの閾値（px）
const SCROLL_THRESHOLD = 100;

export function MessageArea({
  events,
  isLoading,
  error,
  isAgentThinking,
  hasFloatingButton,
}: MessageAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // ユーザーが最下部付近にいるかどうか
  const isNearBottomRef = useRef(true);

  // tool_result を事前に抽出してマップ化
  const toolResultMap = useMemo(() => extractToolResults(events), [events]);

  // 子イベント（parent_tool_use_id を持つ）をグループ化
  const childEventsMap = useMemo(() => groupChildEvents(events), [events]);

  // トップレベルのイベント（parent_tool_use_id を持たない、type: system を除外、isSynthetic を除外）
  const topLevelEvents = useMemo(() => {
    return events.filter(event => {
      const msg = event as Record<string, unknown>;
      // parent_tool_use_id を持つイベントと system タイプは除外
      if (msg.parent_tool_use_id) return false;
      if (msg.type === 'system') return false;
      // Skill 実行時のシステム生成メッセージを除外
      if (msg.isSynthetic) return false;
      return true;
    });
  }, [events]);

  // スクロール位置を監視して最下部付近かどうかを判定
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distanceFromBottom < SCROLL_THRESHOLD;
  }, []);

  // スロットリングされたスクロールハンドラー（100ms間隔）
  const throttledHandleScroll = useMemo(() => throttle(handleScroll, 100), [handleScroll]);

  // スクロールイベントの登録
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', throttledHandleScroll, { passive: true });
    return () => container.removeEventListener('scroll', throttledHandleScroll);
  }, [throttledHandleScroll]);

  // 最下部付近にいる場合のみ自動スクロール
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-destructive text-sm">Error: {error.message}</div>
      </div>
    );
  }

  if (isLoading && events.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingScreen fullScreen={false} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4">
      <div className={cn('w-full max-w-[735px] mx-auto', hasFloatingButton ? 'pb-36' : 'pb-24')}>
        {topLevelEvents.map((event, index) => (
          <EventItem
            key={'uuid' in event ? (event.uuid as string) : `event-${index}`}
            event={event}
            toolResultMap={toolResultMap}
            childEventsMap={childEventsMap}
          />
        ))}
        {isAgentThinking && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
