import { useEffect, useRef } from 'react';
import type { SDKMessage } from '@repo/types';
import { EventItem } from './EventItem';
import { Skeleton } from '@/components/ui/skeleton';

interface MessageAreaProps {
  events: SDKMessage[];
  isLoading?: boolean;
  error?: Error | null;
}

export function MessageArea({ events, isLoading, error }: MessageAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

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
        {events.map((event, index) => (
          <EventItem key={'uuid' in event ? (event.uuid as string) : `event-${index}`} event={event} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
