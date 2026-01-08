import { useState } from 'react';
import type { ChatMessage } from '@repo/types';
import { MainHeader } from './MainHeader';
import { MessageArea } from './MessageArea';
import { InputArea } from './InputArea';

// Mock data for development
const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'コードベース内の小さなTODOを見つけて実行する',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: '2',
    role: 'assistant',
    content: `コードベースを分析して、TODOコメントを探します。

## 環境情報
- Working directory: /home/user/claude-code-on-databricks
- Platform: linux
- Today's date: 2026-01-08

## タスク指示（ここにブランチ指示がある）

### Git Development Branch Requirements
- 作業ブランチ: claude/summarize-context-f7NYV
- 開発・コミット・プッシュのルール

### Git Operations
- push/fetch/pullの方法
- リトライ戦略

## gitStatus（セッション開始時のスナップショット）
- Current branch: claude/summarize-context-f7NYV
- Status: clean
- Recent commits

## CLAUDE.md の内容（<system-reminder>タグ内）`,
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
];

interface MainAreaProps {
  sessionTitle?: string;
  branchName?: string;
  messages?: ChatMessage[];
  onSendMessage?: (content: string) => void;
}

export function MainArea({
  sessionTitle = 'Summarize context content clearly',
  branchName = 'claude/summarize-context-f7NYV',
  messages = MOCK_MESSAGES,
  onSendMessage,
}: MainAreaProps) {
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(messages);

  const handleSend = (content: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    setLocalMessages(prev => [...prev, newMessage]);
    onSendMessage?.(content);

    // Mock assistant response
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'メッセージを受け取りました。処理中です...',
        timestamp: new Date().toISOString(),
      };
      setLocalMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  return (
    <div className="relative z-0 flex flex-col w-full h-full min-w-0 overflow-hidden bg-background">
      <MainHeader title={sessionTitle} branchName={branchName} />
      <MessageArea messages={localMessages} />
      <InputArea onSend={handleSend} />
    </div>
  );
}
