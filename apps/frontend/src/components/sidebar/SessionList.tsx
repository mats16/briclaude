import { Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SessionSummary } from '@repo/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SessionItem } from './SessionItem';

interface SessionListProps {
  sessions: SessionSummary[];
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
}

export function SessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
}: SessionListProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
          {t('sidebar.sessions')}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
          <Filter className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Separator className="mx-3 shrink-0" />
      <ScrollArea className="flex-1">
        <div className="py-2 px-1 space-y-0.5">
          {sessions.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {t('sidebar.noSessions')}
              </p>
            </div>
          ) : (
            sessions.map((session) => (
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
