import { useState, useMemo } from 'react';
import { Filter, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SessionResponse } from '@repo/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SessionItem } from './SessionItem';

type SessionFilter = 'active' | 'archived' | 'all';

interface SessionListProps {
  sessions: SessionResponse[];
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  isLoading?: boolean;
}

export function SessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
  isLoading = false,
}: SessionListProps) {
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
            <DropdownMenuItem onClick={() => setFilter('active')}>
              <Check className={`mr-2 h-4 w-4 ${filter === 'active' ? 'opacity-100' : 'opacity-0'}`} />
              {t('sidebar.filter.active')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('archived')}>
              <Check className={`mr-2 h-4 w-4 ${filter === 'archived' ? 'opacity-100' : 'opacity-0'}`} />
              {t('sidebar.filter.archived')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter('all')}>
              <Check className={`mr-2 h-4 w-4 ${filter === 'all' ? 'opacity-100' : 'opacity-0'}`} />
              {t('sidebar.filter.all')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Separator className="mx-3 shrink-0" />
      <ScrollArea className="flex-1">
        <div className="py-2 px-1 space-y-0.5">
          {isLoading ? (
            <div className="space-y-1 px-2">
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{t('sidebar.noSessions')}</p>
            </div>
          ) : (
            filteredSessions.map(session => (
              <SessionItem
                key={session.id}
                session={session}
                isSelected={session.id === selectedSessionId}
                onClick={() => onSelectSession?.(session.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
