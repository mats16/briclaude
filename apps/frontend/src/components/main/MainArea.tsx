import { useParams, useLocation, useNavigationType } from 'react-router-dom';
import type { SessionEventData } from '@repo/types';
import { MainHeader } from './MainHeader';
import { MessageArea } from './MessageArea';
import { InputArea } from './InputArea';
import { useSessionEvents } from '@/hooks/useSessionEvents';

interface MainAreaProps {
  sessionTitle?: string;
  branchName?: string;
  onSendMessage?: (content: string) => void;
}

interface LocationState {
  initialEvents?: SessionEventData[];
}

export function MainArea({
  sessionTitle = 'New Session',
  branchName,
  onSendMessage,
}: MainAreaProps) {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const location = useLocation();
  const navigationType = useNavigationType();
  const locationState = location.state as LocationState | null;

  // navigationType が 'POP' の場合（URL直接アクセス、リロード、ブラウザバック）は
  // initialEvents を使用しない（API から取得する）
  // 'PUSH' の場合のみ initialEvents を使用（新規セッション作成時）
  const shouldUseInitialEvents = navigationType === 'PUSH';

  const { events, isLoading, isConnected, error } = useSessionEvents({
    sessionId: sessionId ?? null,
    initialEvents: shouldUseInitialEvents ? locationState?.initialEvents : undefined,
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
