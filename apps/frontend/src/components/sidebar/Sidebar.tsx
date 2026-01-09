import { useNavigate } from 'react-router-dom';
import type { SessionSummary, SessionCreateRequest } from '@repo/types';
import { SidebarHeader } from './SidebarHeader';
import { NewSessionInput } from './NewSessionInput';
import { ModelSelector } from './ModelSelector';
import { SessionList } from './SessionList';
import { UserMenu } from './UserMenu';
import { useUser } from '@/hooks/useUser';
import { sessionService } from '@/services';

// Mock data for development
const MOCK_SESSIONS: SessionSummary[] = [
  {
    id: '1',
    title: 'Summarize context content clearly',
    session_status: 'idle',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '2',
    title: 'Debug authentication flow',
    session_status: 'idle',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '3',
    title: 'Implement user dashboard',
    session_status: 'archived',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

interface SidebarProps {
  sessions?: SessionSummary[];
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
}

export function Sidebar({
  sessions = MOCK_SESSIONS,
  selectedSessionId = '1',
  onSelectSession,
}: SidebarProps) {
  const navigate = useNavigate();
  const { user, databricksHost, isLoading, error, refetch } = useUser();

  const handleNewSession = async (content: string, modelId: string) => {
    const request: SessionCreateRequest = {
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
