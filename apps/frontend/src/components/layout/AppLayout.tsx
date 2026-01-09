import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSessions } from '@/hooks/useSessions';
import { sessionService } from '@/services';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { MainArea } from '@/components/main/MainArea';
import { cn } from '@/lib/utils';
import { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_DEFAULT_WIDTH } from '@/constants';

export function AppLayout() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { sessions, isLoading: isSessionsLoading, refetch: refetchSessions } = useSessions();

  const handleSelectSession = useCallback(
    (selectedSessionId: string) => {
      navigate(`/${selectedSessionId}`);
    },
    [navigate]
  );

  const handleArchiveSession = useCallback(
    async (targetSessionId: string) => {
      await sessionService.updateSession(targetSessionId, {
        session_status: 'archived',
      });
      refetchSessions();
      if (sessionId === targetSessionId) {
        navigate('/');
      }
    },
    [refetchSessions, sessionId, navigate]
  );

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= SIDEBAR_MIN_WIDTH && width <= SIDEBAR_MAX_WIDTH) {
        return width;
      }
    }
    return SIDEBAR_DEFAULT_WIDTH;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarWidthRef = useRef(sidebarWidth);

  // Keep ref in sync with state
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const clampedWidth = Math.min(Math.max(newWidth, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      localStorage.setItem('sidebar-width', sidebarWidthRef.current.toString());
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div ref={containerRef} className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div style={{ width: sidebarWidth }} className="h-full shrink-0">
        <Sidebar
          sessions={sessions}
          selectedSessionId={sessionId}
          onSelectSession={handleSelectSession}
          onArchiveSession={handleArchiveSession}
          isSessionsLoading={isSessionsLoading}
          onSessionCreated={refetchSessions}
        />
      </div>

      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'w-1 h-full shrink-0 cursor-col-resize transition-colors',
          'bg-border hover:bg-primary/30',
          isDragging && 'bg-primary/50'
        )}
      />

      {/* Main Area */}
      <div className="flex-1 h-full min-w-0">
        <MainArea onSessionArchived={refetchSessions} />
      </div>

      {/* Overlay during drag to prevent text selection */}
      {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </div>
  );
}
