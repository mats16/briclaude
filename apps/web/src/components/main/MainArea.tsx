import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import type { SessionCreateRequest } from '@repo/types';
import { MainHeader } from './MainHeader';
import { MessageArea } from './MessageArea';
import { InputArea } from './InputArea';
import { WelcomeScreen } from './WelcomeScreen';
import { useSessionEvents } from '@/hooks/useSessionEvents';
import { useSession } from '@/hooks/useSession';
import { sessionService } from '@/services/session.service';
import { Button } from '@/components/ui/button';

interface MainAreaProps {
  branchName?: string;
  onSendMessage?: (content: string) => void;
  onSessionArchived?: () => void;
  onSessionCreated?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function MainArea({
  branchName,
  onSendMessage,
  onSessionArchived,
  onSessionCreated,
  isSidebarOpen = true,
  onToggleSidebar,
}: MainAreaProps) {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [sessionError, setSessionError] = useState<string | null>(null);

  const { session, updateSession } = useSession({
    sessionId: sessionId ?? null,
  });

  const { events, isLoading, isConnected, error, sendMessage } = useSessionEvents({
    sessionId: sessionId ?? null,
  });

  const handleSend = (content: string) => {
    onSendMessage?.(content);
    sendMessage(content);
  };

  const handleTitleUpdate = async (newTitle: string) => {
    await updateSession({ title: newTitle });
  };

  const handleArchive = async () => {
    if (!sessionId) return;
    await sessionService.archiveSession(sessionId);
    onSessionArchived?.();
  };

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

  // セッション未選択時はウェルカムスクリーンを表示
  if (!sessionId) {
    return (
      <div className="relative z-0 flex flex-col w-full h-full min-w-0 overflow-hidden bg-background">
        {/* Simple header with toggle button only */}
        <div className="flex items-center h-[50px] px-2 border-b border-border shrink-0">
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="h-8 w-8 shrink-0"
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        <WelcomeScreen onNewSession={handleNewSession} sessionError={sessionError} />
      </div>
    );
  }

  return (
    <div className="relative z-0 flex flex-col w-full h-full min-w-0 overflow-hidden bg-background">
      <MainHeader
        sessionId={sessionId}
        title={session?.title ?? 'New Session'}
        branchName={branchName}
        isConnected={isConnected}
        onTitleUpdate={handleTitleUpdate}
        onArchive={handleArchive}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />
      <MessageArea events={events} isLoading={isLoading} error={error} />
      <InputArea
        sessionId={sessionId}
        onSend={handleSend}
        disabled={session?.session_status === 'archived'}
      />
    </div>
  );
}
