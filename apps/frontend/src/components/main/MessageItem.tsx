import type { ChatMessage } from '@repo/types';
import { cn } from '@/lib/utils';

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('py-3', isUser && 'flex justify-end')}>
      <div
        className={cn(
          'text-sm text-foreground whitespace-pre-wrap break-words',
          isUser && 'bg-muted rounded-2xl px-4 py-2 max-w-[80%]'
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
