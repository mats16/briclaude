import { useMemo } from 'react';
import type { SDKMessage } from '@repo/types';
import { cn } from '@/lib/utils';

interface EventItemProps {
  event: SDKMessage;
}

interface ParsedContent {
  role: 'user' | 'assistant' | 'system';
  text: string;
}

export function EventItem({ event }: EventItemProps) {
  // SDKMessage を直接使用
  const msg = event as Record<string, unknown>;
  const type = event.type;
  const subtype = 'subtype' in event ? (event.subtype as string | undefined) : undefined;

  // SDK メッセージの種類に応じて表示を変更
  const content = useMemo((): ParsedContent | null => {
    // user メッセージ
    if (type === 'user' && msg.message) {
      const userMsg = msg.message as { role: string; content: unknown };
      if (typeof userMsg.content === 'string') {
        return { role: 'user', text: userMsg.content };
      }
      // content が配列の場合（TextBlock など）
      if (Array.isArray(userMsg.content)) {
        const textContent = userMsg.content
          .filter((c: unknown) => (c as { type: string }).type === 'text')
          .map((c: unknown) => (c as { text: string }).text)
          .join('\n');
        return { role: 'user', text: textContent };
      }
    }

    // assistant メッセージ
    if (type === 'assistant') {
      // message.content を取得
      const assistantMsg = msg.message as { content?: unknown[] } | undefined;
      if (assistantMsg && Array.isArray(assistantMsg.content)) {
        const textContent = assistantMsg.content
          .filter((c: unknown) => (c as { type: string }).type === 'text')
          .map((c: unknown) => (c as { text: string }).text)
          .join('\n');
        if (textContent) {
          return { role: 'assistant', text: textContent };
        }
      }
      // メッセージ直下の content を確認
      if (Array.isArray(msg.content)) {
        const textContent = (msg.content as unknown[])
          .filter((c: unknown) => (c as { type: string }).type === 'text')
          .map((c: unknown) => (c as { text: string }).text)
          .join('\n');
        if (textContent) {
          return { role: 'assistant', text: textContent };
        }
      }
    }

    // system init メッセージ
    if (type === 'system' && subtype === 'init') {
      const model = (msg as { model?: string }).model;
      return { role: 'system', text: `Session initialized${model ? ` (model: ${model})` : ''}` };
    }

    // result メッセージ
    if (type === 'result') {
      const resultMsg = msg as { subtype?: string; result?: string };
      if (resultMsg.subtype === 'success') {
        return { role: 'system', text: resultMsg.result || 'Task completed.' };
      }
      return { role: 'system', text: `Result: ${resultMsg.subtype || 'unknown'}` };
    }

    // stream_event（部分レスポンス）はスキップ
    if (type === 'stream_event') {
      return null;
    }

    // その他のイベントは非表示
    return null;
  }, [type, subtype, msg]);

  if (!content) return null;

  const isUser = content.role === 'user';
  const isSystem = content.role === 'system';

  return (
    <div className={cn('py-3', isUser && 'flex justify-end')}>
      <div
        className={cn(
          'text-sm whitespace-pre-wrap break-words',
          isUser && 'bg-muted rounded-2xl px-4 py-2 max-w-[80%] text-foreground',
          !isUser && 'text-foreground',
          isSystem && 'text-muted-foreground text-xs'
        )}
      >
        {content.text}
      </div>
    </div>
  );
}
