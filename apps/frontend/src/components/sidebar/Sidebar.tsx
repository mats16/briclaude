import { useNavigate } from 'react-router-dom';
import type { SessionSummary, SessionStartRequest } from '@repo/types';
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
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '2',
    title: 'Debug authentication flow',
    isArchived: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '3',
    title: 'Implement user dashboard',
    isArchived: false,
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
    const request: SessionStartRequest = {
      events: [
        {
          uuid: crypto.randomUUID(),
          type: 'user',
          message: {
            role: 'user',
            content: [{ type: 'text', text: content }],
          },
        },
      ],
      session_context: {
        model: modelId as 'opus' | 'sonnet' | 'haiku',
        databricksWorkspacePath: null,
        databricksWorkspaceAutoPush: false,
      },
    };

    const response = await sessionService.startSession(request);
    navigate(`/${response.session_id}`);
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
