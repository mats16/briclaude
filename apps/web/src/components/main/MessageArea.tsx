import { useEffect, useMemo, useRef } from 'react';
import type { SDKMessage } from '@repo/types';
import { EventItem } from './EventItem';
import { Skeleton } from '@/components/ui/skeleton';
import { extractToolResults, groupChildEvents } from '@/lib/message-utils';

interface MessageAreaProps {
  events: SDKMessage[];
  isLoading?: boolean;
  error?: Error | null;
}

export function MessageArea({ events, isLoading, error }: MessageAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // tool_result を事前に抽出してマップ化
  const toolResultMap = useMemo(() => extractToolResults(events), [events]);

  // 子イベント（parent_tool_use_id を持つ）をグループ化
  const childEventsMap = useMemo(() => groupChildEvents(events), [events]);

  // トップレベルのイベント（parent_tool_use_id を持たない）のみをフィルタ
  const topLevelEvents = useMemo(() => {
    return events.filter(event => {
      const msg = event as Record<string, unknown>;
      return !msg.parent_tool_use_id;
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
      <div className="flex-1 overflow-y-auto px-4">
        <div className="w-full max-w-[735px] mx-auto pb-24 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4">
      <div className="w-full max-w-[735px] mx-auto pb-24">
        {topLevelEvents.map((event, index) => (
          <EventItem
            key={'uuid' in event ? (event.uuid as string) : `event-${index}`}
            event={event}
            toolResultMap={toolResultMap}
            childEventsMap={childEventsMap}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
