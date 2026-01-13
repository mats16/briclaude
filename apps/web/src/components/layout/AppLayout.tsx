import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { SessionResponse } from '@repo/types';
import { useSessions } from '@/hooks/useSessions';
import { useIsMobile } from '@/hooks/use-mobile';
import { sessionService } from '@/services';
import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { MainArea } from '@/components/main/MainArea';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const SIDEBAR_WIDTH = 300;

export function AppLayout() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const {
    sessions,
    isLoading: isSessionsLoading,
    refetch: refetchSessions,
    updateSession,
    getSession,
  } = useSessions();
  const isMobile = useIsMobile();

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar-open');
    return saved !== 'false';
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => {
      const newValue = !prev;
      localStorage.setItem('sidebar-open', String(newValue));
      return newValue;
    });
  }, []);

  const handleSelectSession = useCallback(
    (selectedSessionId: string) => {
      navigate(`/${selectedSessionId}`);
    },
    [navigate]
  );

  const handleArchiveSession = useCallback(
    async (targetSessionId: string, shouldNavigate = false) => {
      const originalSession = getSession(targetSessionId);
      if (!originalSession) return;

      // Optimistic update
      const optimisticSession: SessionResponse = {
        ...originalSession,
        session_status: 'archived',
      };
      updateSession(optimisticSession);

      // Navigate if needed
      const needsNavigation = shouldNavigate || sessionId === targetSessionId;
      if (needsNavigation) {
        navigate('/');
      }

      try {
        await sessionService.archiveSession(targetSessionId);
      } catch {
        // Rollback on failure
        updateSession(originalSession);
        toast.error('Failed to archive session');
      }
    },
    [getSession, updateSession, sessionId, navigate]
  );

  const handleMainAreaArchive = useCallback(
    (targetSessionId: string) => handleArchiveSession(targetSessionId, true),
    [handleArchiveSession]
  );

  const sidebarProps = useMemo(
    () => ({
      sessions,
      selectedSessionId: sessionId,
      onSelectSession: handleSelectSession,
      onArchiveSession: handleArchiveSession,
      isSessionsLoading,
    }),
    [sessions, sessionId, handleSelectSession, handleArchiveSession, isSessionsLoading]
  );

  // Mobile: SidebarProvider manages open state internally via SidebarTrigger (offcanvas mode)
  // Desktop: We manage open state manually with isSidebarOpen/toggleSidebar for smooth animation
  if (isMobile) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="flex h-screen w-screen overflow-hidden bg-background">
          <AppSidebar {...sidebarProps} collapsible="offcanvas" />
          <div className="flex-1 h-full min-w-0 flex flex-col">
            <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
              <SidebarTrigger />
            </div>
            <div className="flex-1 min-h-0">
              <MainArea onSessionArchived={handleMainAreaArchive} onSessionCreated={refetchSessions} />
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      defaultOpen={true}
      style={
        {
          '--sidebar-width': `${SIDEBAR_WIDTH}px`,
        } as React.CSSProperties
      }
    >
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <div
          className={cn(
            'h-full shrink-0 transition-all duration-300 ease-in-out overflow-hidden',
            isSidebarOpen ? 'w-[300px]' : 'w-0'
          )}
        >
          <div className="w-[300px] h-full">
            <AppSidebar {...sidebarProps} />
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 h-full min-w-0">
          <MainArea
            onSessionArchived={handleMainAreaArchive}
            onSessionCreated={refetchSessions}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={toggleSidebar}
          />
        </div>
      </div>
    </SidebarProvider>
  );
}
