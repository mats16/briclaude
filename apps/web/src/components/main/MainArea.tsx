import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  SessionCreateRequest,
  UserMessageContentBlock,
  SessionOutcome,
  DatabricksAppsOutcome,
  DatabricksWorkspaceSource,
  WorkspaceSelection,
} from '@repo/types';
import { MainHeader } from './MainHeader';
import { MessageArea } from './MessageArea';
import { InputArea } from './InputArea';
import { WelcomeScreen } from './WelcomeScreen';
import { SessionNotFound } from './SessionNotFound';
import { FloatingButtons } from './FloatingButtons';
import { useSessionEvents } from '@/hooks/useSessionEvents';
import { useSession } from '@/hooks/useSession';
import { sessionService } from '@/services/session.service';
import { extractTextFromContent } from '@/lib/content-builder';

interface MainAreaProps {
  branchName?: string;
  onSendMessage?: (content: UserMessageContentBlock[]) => void;
  onSessionArchived?: (sessionId: string) => void;
  onSessionCreated?: () => void;
}

export function MainArea({
  branchName,
  onSendMessage,
  onSessionArchived,
  onSessionCreated,
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

  const { events, isLoading, error, sendMessage, abort } = useSessionEvents({
    sessionId: sessionId ?? null,
  });

  // 最後のイベントが result でない場合、エージェントが応答中
  const isAgentThinking = useMemo(() => {
    if (events.length === 0) return false;
    const lastEvent = events[events.length - 1];
    return lastEvent.type !== 'result';
  }, [events]);

  // session_context.outcomes から databricks_apps を取得
  const databricksAppsOutcome = useMemo(() => {
    const outcomes = session?.session_context?.outcomes;
    if (!outcomes) return null;
    return outcomes.find((o): o is DatabricksAppsOutcome => o.type === 'databricks_apps') ?? null;
  }, [session?.session_context?.outcomes]);

  // session_context.outcomes から databricks_workspace を取得
  const databricksWorkspaceOutcome = useMemo(() => {
    const outcomes = session?.session_context?.outcomes;
    if (!outcomes) return null;
    return (
      outcomes.find((o): o is DatabricksWorkspaceSource => o.type === 'databricks_workspace') ??
      null
    );
  }, [session?.session_context?.outcomes]);

  // フローティングボタンを表示するかどうか
  const hasFloatingButtons = !!databricksAppsOutcome || !!databricksWorkspaceOutcome;

  const handleSend = (content: UserMessageContentBlock[]) => {
    onSendMessage?.(content);
    sendMessage(content);
  };

  const handleTitleUpdate = async (newTitle: string) => {
    await updateSession({ title: newTitle });
  };

  const handleArchive = async () => {
    if (!sessionId) return;
    onSessionArchived?.(sessionId);
  };

  const handleNewSession = async (
    content: UserMessageContentBlock[],
    modelId: string,
    workspaceSelection: WorkspaceSelection | null,
    enableDatabricksApps: boolean
  ) => {
    try {
      setCreateSessionError(null);
      // タイトル生成用にテキストを抽出
      const textContent = extractTextFromContent(content);
      const title = await sessionService.generateTitle(textContent);

      // outcomes の構築
      const outcomes: SessionOutcome[] = [];
      if (workspaceSelection) {
        outcomes.push({
          type: 'databricks_workspace',
          path: workspaceSelection.path,
          id: workspaceSelection.object_id,
        });
      }
      if (enableDatabricksApps) {
        outcomes.push({ type: 'databricks_apps' });
      }

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
          sources: workspaceSelection
            ? [
                {
                  type: 'databricks_workspace',
                  path: workspaceSelection.path,
                  id: workspaceSelection.object_id,
                },
              ]
            : [],
          outcomes: outcomes,
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
        <WelcomeScreen onNewSession={handleNewSession} sessionError={createSessionError} />
      </div>
    );
  }

  // セッションが見つからない場合
  if (!isSessionLoading && sessionLoadError) {
    return <SessionNotFound onGoHome={() => navigate('/')} />;
  }

  return (
    <div className="relative z-0 flex flex-col w-full h-full min-w-0 overflow-hidden bg-background">
      <MainHeader
        title={session?.title ?? 'New Session'}
        branchName={branchName}
        onTitleUpdate={handleTitleUpdate}
        onArchive={handleArchive}
      />
      <MessageArea
        events={events}
        isLoading={isLoading}
        error={error}
        isAgentThinking={isAgentThinking}
        hasFloatingButton={hasFloatingButtons}
      />
      <InputArea
        sessionId={sessionId}
        onSend={handleSend}
        onAbort={abort}
        isAgentThinking={isAgentThinking}
        disabled={session?.session_status === 'archived'}
      />
      {hasFloatingButtons && (
        <FloatingButtons
          sessionId={sessionId}
          showAppButton={!!databricksAppsOutcome}
          workspaceObjectId={databricksWorkspaceOutcome?.id}
        />
      )}
    </div>
  );
}
