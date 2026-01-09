import type { SessionResponse } from '@repo/types';
import { cn } from '@/lib/utils';

interface SessionItemProps {
  session: SessionResponse;
  isSelected?: boolean;
  onClick?: () => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function SessionItem({ session, isSelected, onClick }: SessionItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-md transition-colors',
        'hover:bg-muted/50',
        isSelected && 'bg-muted'
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground line-clamp-1">
          {session.title || 'Untitled Session'}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(session.updated_at)}
        </span>
      </div>
    </button>
  );
}
