import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SessionResponse, SessionCreateRequest } from '@repo/types';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { AppSidebarHeader } from './AppSidebarHeader';
import { NewSessionInput } from './NewSessionInput';
import { SessionGroup } from './SessionGroup';
import { UserFooter } from './UserFooter';
import { useUser } from '@/hooks/useUser';
import { sessionService } from '@/services';

interface AppSidebarProps {
  sessions?: SessionResponse[];
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onArchiveSession?: (sessionId: string) => void;
  isSessionsLoading?: boolean;
  onSessionCreated?: () => void;
  collapsible?: 'offcanvas' | 'icon' | 'none';
}

export function AppSidebar({
  sessions = [],
  selectedSessionId,
  onSelectSession,
  onArchiveSession,
  isSessionsLoading = false,
  onSessionCreated,
  collapsible = 'none',
}: AppSidebarProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, databricksHost, isLoading, error, refetch } = useUser();
  const [sessionError, setSessionError] = useState<string | null>(null);

  const handleNewSession = async (content: string, modelId: string) => {
    try {
      setSessionError(null);
      const title = await sessionService.generateTitle(content);

      const request: SessionCreateRequest = {
        title: title ?? undefined,
        events: [
          {
            type: 'event',
            data: {
              uuid: crypto.randomUUID(),
              session_id: '',
              type: 'user',
              parent_tool_use_id: null,
              message: {
                role: 'user',
                content: content,
              },
            },
          },
        ],
        session_context: {
          model: modelId as 'opus' | 'sonnet' | 'haiku',
          sources: [],
          outcomes: [],
        },
      };

      const response = await sessionService.createSession(request);
      onSessionCreated?.();
      navigate(`/${response.id}`);
    } catch (err) {
      console.error('Failed to create session:', err);
      setSessionError(t('sidebar.sessionCreateError'));
      throw err;
    }
  };

  return (
    <Sidebar collapsible={collapsible} className="border-r">
      <SidebarHeader className="p-0">
        <AppSidebarHeader />
        <NewSessionInput onSubmit={handleNewSession} />
        {sessionError && (
          <div className="px-3 pb-2">
            <p className="text-xs text-destructive">{sessionError}</p>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SessionGroup
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={onSelectSession}
          onArchiveSession={onArchiveSession}
          isLoading={isSessionsLoading}
        />
      </SidebarContent>
      <SidebarFooter className="p-0">
        <UserFooter
          userName={user?.name}
          databricksHost={databricksHost}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
