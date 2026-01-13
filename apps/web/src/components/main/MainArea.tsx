import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SessionCreateRequest, SessionResponse, UserMessageContentBlock } from '@repo/types';
import { MainHeader } from './MainHeader';
import { MessageArea } from './MessageArea';
import { InputArea } from './InputArea';
import { WelcomeScreen } from './WelcomeScreen';
import { SessionNotFound } from './SessionNotFound';
import { useSessionEvents } from '@/hooks/useSessionEvents';
import { useSession } from '@/hooks/useSession';
import { sessionService } from '@/services/session.service';
import { SidebarToggleButton } from '@/components/layout/SidebarToggleButton';
import { extractTextFromContent } from '@/lib/content-builder';

interface MainAreaProps {
  branchName?: string;
  onSendMessage?: (content: UserMessageContentBlock[]) => void;
  onSessionArchived?: (session: SessionResponse) => void;
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
  const [createSessionError, setCreateSessionError] = useState<string | null>(null);

  const {
    session,
    updateSession,
    isLoading: isSessionLoading,
    error: sessionLoadError,
  } = useSession({
    sessionId: sessionId ?? null,
  });

  const { events, isLoading, error, sendMessage } = useSessionEvents({
    sessionId: sessionId ?? null,
  });

  // 最後のイベントが result でない場合、エージェントが応答中
  const isAgentThinking = useMemo(() => {
    if (events.length === 0) return false;
    const lastEvent = events[events.length - 1];
    return lastEvent.type !== 'result';
  }, [events]);

  // session_context.sources から databricks_workspace のパスを取得
  const workspacePath = useMemo(() => {
    const sources = session?.session_context?.sources;
    if (!sources) return null;
    const workspaceSource = sources.find(s => s.type === 'databricks_workspace');
    return workspaceSource?.path ?? null;
  }, [session?.session_context?.sources]);

  const handleSend = (content: UserMessageContentBlock[]) => {
    onSendMessage?.(content);
    sendMessage(content);
  };

  const handleTitleUpdate = async (newTitle: string) => {
    await updateSession({ title: newTitle });
  };

  const handleArchive = async () => {
    if (!sessionId) return;
    const archivedSession = await sessionService.archiveSession(sessionId);
    onSessionArchived?.(archivedSession);
  };

  const handleNewSession = async (
    content: UserMessageContentBlock[],
    modelId: string,
    workspacePath: string | null
  ) => {
    try {
      setCreateSessionError(null);
      // タイトル生成用にテキストを抽出
      const textContent = extractTextFromContent(content);
      const title = await sessionService.generateTitle(textContent);

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
          sources: workspacePath ? [{ type: 'databricks_workspace', path: workspacePath }] : [],
          outcomes: workspacePath ? [{ type: 'databricks_workspace', path: workspacePath }] : [],
        },
      };

      const response = await sessionService.createSession(request);
      onSessionCreated?.();
      navigate(`/${response.id}`);
    } catch (err) {
      console.error('Failed to create session:', err);
      setCreateSessionError(t('sidebar.sessionCreateError'));
    }
  };

  // セッション未選択時はウェルカムスクリーンを表示
  if (!sessionId) {
    return (
      <div className="relative z-0 flex flex-col w-full h-full min-w-0 overflow-hidden bg-background">
        {/* Simple header with toggle button only */}
        <div className="flex items-center h-[50px] px-2 border-b border-border shrink-0">
          {onToggleSidebar && (
            <SidebarToggleButton isOpen={isSidebarOpen} onToggle={onToggleSidebar} />
          )}
        </div>
        <WelcomeScreen onNewSession={handleNewSession} sessionError={createSessionError} />
      </div>
    );
  }

  // セッションが見つからない場合
  if (!isSessionLoading && sessionLoadError) {
    return (
      <SessionNotFound
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onGoHome={() => navigate('/')}
      />
    );
  }

  return (
    <div className="relative z-0 flex flex-col w-full h-full min-w-0 overflow-hidden bg-background">
      <MainHeader
        title={session?.title ?? 'New Session'}
        branchName={branchName}
        workspacePath={workspacePath}
        onTitleUpdate={handleTitleUpdate}
        onArchive={handleArchive}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />
      <MessageArea
        events={events}
        isLoading={isLoading}
        error={error}
        isAgentThinking={isAgentThinking}
      />
      <InputArea
        sessionId={sessionId}
        onSend={handleSend}
        disabled={session?.session_status === 'archived'}
      />
    </div>
  );
}
