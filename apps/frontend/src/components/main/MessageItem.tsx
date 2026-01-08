import { User, Bot } from 'lucide-react';
import type { ChatMessage } from '@repo/types';
import { cn } from '@/lib/utils';

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-4',
        isUser && 'bg-muted/30'
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
          isUser && 'bg-primary text-primary-foreground',
          isAssistant && 'bg-orange-500 text-white'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}
