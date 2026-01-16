import { useEffect, useMemo, useRef } from 'react';
import type { SDKMessage } from '@repo/types';
import { EventItem } from './EventItem';
import { ThinkingIndicator } from './ThinkingIndicator';
import { LoadingScreen } from '@/components/ui/loading-spinner';
import { extractToolResults, groupChildEvents } from '@/lib/message-utils';
import { cn } from '@/lib/utils';

interface MessageAreaProps {
  events: SDKMessage[];
  isLoading?: boolean;
  error?: Error | null;
  isAgentThinking?: boolean;
  hasFloatingButton?: boolean;
}

export function MessageArea({
  events,
  isLoading,
  error,
  isAgentThinking,
  hasFloatingButton,
}: MessageAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="flex-1 overflow-y-auto px-4">
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
