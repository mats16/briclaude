import { useNavigate } from 'react-router-dom';
import type { SessionResponse, SessionCreateRequest } from '@repo/types';
import { SidebarHeader } from './SidebarHeader';
import { NewSessionInput } from './NewSessionInput';
import { ModelSelector } from './ModelSelector';
import { SessionList } from './SessionList';
import { UserMenu } from './UserMenu';
import { useUser } from '@/hooks/useUser';
import { sessionService } from '@/services';

interface SidebarProps {
  sessions?: SessionResponse[];
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onArchiveSession?: (sessionId: string) => void;
  isSessionsLoading?: boolean;
  onSessionCreated?: () => void;
}

export function Sidebar({
  sessions = [],
  selectedSessionId,
  onSelectSession,
  onArchiveSession,
  isSessionsLoading = false,
  onSessionCreated,
}: SidebarProps) {
  const navigate = useNavigate();
  const { user, databricksHost, isLoading, error, refetch } = useUser();

  const handleNewSession = async (content: string, modelId: string) => {
    // タイトルを生成（失敗時は null）
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
  };

  return (
    <div className="relative z-10 flex flex-col w-full h-full min-w-0 overflow-hidden bg-card border-r border-border">
      <SidebarHeader />
      <NewSessionInput onSubmit={handleNewSession} />
      <ModelSelector />
      <SessionList
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={onSelectSession}
        onArchiveSession={onArchiveSession}
        isLoading={isSessionsLoading}
      />
      <UserMenu
        userName={user?.name}
        databricksHost={databricksHost}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
      />
    </div>
  );
}
