import type { SessionResponse } from '@repo/types';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from '@/components/ui/sidebar';
import { AppSidebarHeader } from './AppSidebarHeader';
import { SessionGroup } from './SessionGroup';
import { UserFooter } from './UserFooter';
import { useUser } from '@/hooks/useUser';

interface AppSidebarProps {
  sessions?: SessionResponse[];
  selectedSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onArchiveSession?: (sessionId: string) => void;
  isSessionsLoading?: boolean;
  collapsible?: 'offcanvas' | 'icon' | 'none';
}

export function AppSidebar({
  sessions = [],
  selectedSessionId,
  onSelectSession,
  onArchiveSession,
  isSessionsLoading = false,
  collapsible = 'none',
}: AppSidebarProps) {
  const { user, databricksHost, isLoading, error, refetch } = useUser();

  return (
    <Sidebar collapsible={collapsible} className="border-r">
      <SidebarHeader className="p-0">
        <AppSidebarHeader />
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
