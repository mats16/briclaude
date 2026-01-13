import { useParams } from 'react-router-dom';
import { MainHeader } from './MainHeader';
import { MessageArea } from './MessageArea';
import { InputArea } from './InputArea';
import { WelcomeScreen } from './WelcomeScreen';
import { useSessionEvents } from '@/hooks/useSessionEvents';
import { useSession } from '@/hooks/useSession';
import { sessionService } from '@/services/session.service';

interface MainAreaProps {
  branchName?: string;
  onSendMessage?: (content: string) => void;
  onSessionArchived?: () => void;
}

export function MainArea({ branchName, onSendMessage, onSessionArchived }: MainAreaProps) {
  const { sessionId } = useParams<{ sessionId?: string }>();

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

  // セッション未選択時はウェルカムスクリーンを表示
  if (!sessionId) {
    return (
      <div className="relative z-0 flex flex-col w-full h-full min-w-0 overflow-hidden bg-background">
        <WelcomeScreen />
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
