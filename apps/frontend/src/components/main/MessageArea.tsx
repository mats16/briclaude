import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@repo/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageItem } from './MessageItem';

interface MessageAreaProps {
  messages: ChatMessage[];
}

export function MessageArea({ messages }: MessageAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y divide-border">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
      <div ref={bottomRef} />
    </ScrollArea>
  );
}
