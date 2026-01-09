import { useParams } from 'react-router-dom';
import { MainHeader } from './MainHeader';
import { MessageArea } from './MessageArea';
import { InputArea } from './InputArea';
import { useSessionEvents } from '@/hooks/useSessionEvents';

interface MainAreaProps {
  sessionTitle?: string;
  branchName?: string;
  onSendMessage?: (content: string) => void;
}

export function MainArea({
  sessionTitle = 'New Session',
  branchName,
  onSendMessage,
}: MainAreaProps) {
  const { sessionId } = useParams<{ sessionId?: string }>();

  const { events, isLoading, isConnected, error } = useSessionEvents({
    sessionId: sessionId ?? null,
  });

  const handleSend = (content: string) => {
    onSendMessage?.(content);
    // TODO: 実行中のセッションにメッセージ送信機能（Phase 2）
  };

  return (
    <div className="relative z-0 flex flex-col w-full h-full min-w-0 overflow-hidden bg-background">
      <MainHeader title={sessionTitle} branchName={branchName} isConnected={isConnected} />
      <MessageArea events={events} isLoading={isLoading} error={error} />
      <InputArea sessionId={sessionId} onSend={handleSend} />
    </div>
  );
}
