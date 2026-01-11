import { useState, useMemo } from 'react';
import { Filter, Check, Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SessionResponse } from '@repo/types';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSkeleton,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SessionFilter = 'active' | 'archived' | 'all';

interface SessionGroupProps {
  sessions: SessionResponse[];
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onArchiveSession?: (sessionId: string) => void;
  isLoading?: boolean;
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

export function SessionGroup({
  sessions,
  selectedSessionId,
  onSelectSession,
  onArchiveSession,
  isLoading = false,
}: SessionGroupProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<SessionFilter>('active');

  const filteredSessions = useMemo(() => {
    switch (filter) {
      case 'active':
        return sessions.filter(session => session.session_status !== 'archived');
      case 'archived':
        return sessions.filter(session => session.session_status === 'archived');
      case 'all':
      default:
        return sessions;
    }
  }, [sessions, filter]);

  return (
    <SidebarGroup className="flex-1 overflow-hidden p-0">
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
          {t('sidebar.sessions')}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setFilter('active')}
              className="flex justify-between"
            >
              {t('sidebar.filter.active')}
              <Check
                className={`h-4 w-4 ${filter === 'active' ? 'opacity-100' : 'opacity-0'}`}
              />
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setFilter('archived')}
              className="flex justify-between"
            >
              {t('sidebar.filter.archived')}
              <Check
                className={`h-4 w-4 ${filter === 'archived' ? 'opacity-100' : 'opacity-0'}`}
              />
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setFilter('all')}
              className="flex justify-between"
            >
              {t('sidebar.filter.all')}
              <Check
                className={`h-4 w-4 ${filter === 'all' ? 'opacity-100' : 'opacity-0'}`}
              />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Separator className="mx-3 shrink-0" />
      <SidebarMenu className="flex-1 overflow-auto px-1">
        {isLoading ? (
          <>
            <SidebarMenuSkeleton />
            <SidebarMenuSkeleton />
            <SidebarMenuSkeleton />
          </>
        ) : filteredSessions.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t('sidebar.noSessions')}</p>
          </div>
        ) : (
          filteredSessions.map(session => (
            <SidebarMenuItem key={session.id}>
              <SidebarMenuButton
                isActive={session.id === selectedSessionId}
                onClick={() => onSelectSession?.(session.id)}
                className="h-auto py-2"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium truncate">
                    {session.title || 'Untitled Session'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(session.updated_at)}
                  </span>
                </div>
              </SidebarMenuButton>
              {onArchiveSession && (
                <SidebarMenuAction
                  showOnHover
                  onClick={e => {
                    e.stopPropagation();
                    onArchiveSession(session.id);
                  }}
                >
                  <Archive className="size-4" />
                </SidebarMenuAction>
              )}
            </SidebarMenuItem>
          ))
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
