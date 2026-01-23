import { useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { SessionResponse } from '@repo/types';
import { useSessions } from '@/hooks/useSessions';
import { useIsMobile } from '@/hooks/use-mobile';
import { sessionService } from '@/services';
import { AppSidebar } from '@/components/sidebar/AppSidebar';
import { MainArea } from '@/components/main/MainArea';
import { SkillsContent } from '@/pages/SkillsPage';
import { AgentsContent } from '@/pages/AgentsPage';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON } from '@/constants';

export function AppLayout() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isSkillsPage = location.pathname === '/skills';
  const isAgentsPage = location.pathname === '/agents';
  const {
    sessions,
    isLoading: isSessionsLoading,
    refetch: refetchSessions,
    updateSession,
    getSession,
  } = useSessions();
  const isMobile = useIsMobile();

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
        toast.error(t('main.archiveSessionError'));
      }
    },
    [getSession, updateSession, sessionId, navigate, t]
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
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <div className="flex h-screen w-screen overflow-hidden bg-background">
            <AppSidebar {...sidebarProps} collapsible="offcanvas" />
            <div className="flex-1 h-full min-w-0 flex flex-col">
              <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
                <SidebarTrigger />
              </div>
              <div className="flex-1 min-h-0">
                {isSkillsPage ? (
                  <SkillsContent />
                ) : isAgentsPage ? (
                  <AgentsContent />
                ) : (
                  <MainArea
                    onSessionArchived={handleMainAreaArchive}
                    onSessionCreated={refetchSessions}
                  />
                )}
              </div>
            </div>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen={true}
        style={
          {
            '--sidebar-width': `${SIDEBAR_WIDTH}px`,
            '--sidebar-width-icon': `${SIDEBAR_WIDTH_ICON}px`,
          } as React.CSSProperties
        }
      >
        <div className="flex h-screen w-screen overflow-hidden bg-background">
          {/* Sidebar */}
          <AppSidebar {...sidebarProps} collapsible="icon" />

          {/* Main Area */}
          <div className="flex-1 h-full min-w-0">
            {isSkillsPage ? (
              <SkillsContent />
            ) : isAgentsPage ? (
              <AgentsContent />
            ) : (
              <MainArea
                onSessionArchived={handleMainAreaArchive}
                onSessionCreated={refetchSessions}
              />
            )}
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
