import type { SessionSummary } from '@repo/types';
import { SidebarHeader } from './SidebarHeader';
import { NewSessionInput } from './NewSessionInput';
import { ModelSelector } from './ModelSelector';
import { SessionList } from './SessionList';
import { UserMenu } from './UserMenu';
import { useUser } from '@/hooks/useUser';

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
  onNewSession?: (content: string, modelId: string) => void;
}

export function Sidebar({
  sessions = MOCK_SESSIONS,
  selectedSessionId = '1',
  onSelectSession,
  onNewSession,
}: SidebarProps) {
  const { user, isLoading, error, refetch } = useUser();

  return (
    <div className="relative z-10 flex flex-col w-full h-full min-w-0 overflow-hidden bg-card border-r border-border">
      <SidebarHeader />
      <NewSessionInput onSubmit={onNewSession} />
      <ModelSelector />
      <SessionList
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSession={onSelectSession}
      />
      <UserMenu
        userName={user?.name}
        userEmail={user?.email}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
      />
    </div>
  );
}
