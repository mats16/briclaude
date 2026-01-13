import { useMemo } from 'react';
import type { SDKMessage } from '@repo/types';
import {
  isSDKUserMessageEvent,
  isSDKAssistantMessageEvent,
  isSDKSystemMessageEvent,
  isTextContentBlock,
  isToolUseContentBlock,
} from '@repo/types';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolUseBlock } from './ToolUseBlock';
import { MarkdownContent } from './MarkdownContent';
import {
  extractToolUseBlocksAsMap,
  type ToolResult,
  type ToolUseBlock as ToolUseBlockType,
} from '@/lib/message-utils';

interface EventItemProps {
  event: SDKMessage;
  toolResultMap: Map<string, ToolResult>;
  childEventsMap: Map<string, SDKMessage[]>;
}

interface TextContent {
  type: 'text';
  text: string;
}

interface ToolUseContent {
  type: 'tool_use';
  toolUse: ToolUseBlockType;
  result?: ToolResult;
}

type ContentBlock = TextContent | ToolUseContent;

interface ParsedMessage {
  role: 'user' | 'assistant' | 'system';
  contents: ContentBlock[];
}

export function EventItem({ event, toolResultMap, childEventsMap }: EventItemProps) {
  const parsed = useMemo((): ParsedMessage | null => {
    // user メッセージ
    if (isSDKUserMessageEvent(event)) {
      const content = event.message.content;

      // content が配列の場合
      if (Array.isArray(content)) {
        // テキストコンテンツのみを抽出（tool_result は除外）
        const textContent = content
          .filter(isTextContentBlock)
          .map(c => c.text)
          .join('\n');

        // テキストがある場合のみ表示、それ以外はスキップ
        if (textContent) {
          return {
            role: 'user',
            contents: [{ type: 'text', text: textContent }],
          };
        }
        // tool_result のみや空の配列はスキップ
        return null;
      }

      if (typeof content === 'string') {
        return {
          role: 'user',
          contents: [{ type: 'text', text: content }],
        };
      }

      // その他の形式はスキップ
      return null;
    }

    // assistant メッセージ
    if (isSDKAssistantMessageEvent(event)) {
      const rawContent = event.message.content ?? [];
      const contents: ContentBlock[] = [];

      // tool_use ブロックを事前に Map として抽出（O(1) アクセス用）
      const toolBlockMap = extractToolUseBlocksAsMap(event);

      // テキストと tool_use を順序通りに処理
      for (const block of rawContent) {
        if (isTextContentBlock(block)) {
          contents.push({ type: 'text', text: block.text });
        } else if (isToolUseContentBlock(block)) {
          // Map から O(1) で取得
          const toolBlock = toolBlockMap.get(block.id);

          if (toolBlock) {
            contents.push({
              type: 'tool_use',
              toolUse: toolBlock,
              result: toolResultMap.get(toolBlock.id),
            });
          }
        }
      }

      if (contents.length > 0) {
        return { role: 'assistant', contents };
      }
    }

    // system init メッセージ
    if (isSDKSystemMessageEvent(event) && event.subtype === 'init') {
      return {
        role: 'system',
        contents: [
          {
            type: 'text',
            text: `Session initialized${event.model ? ` (model: ${event.model})` : ''}`,
          },
        ],
      };
    }

    // result メッセージはスキップ
    if (event.type === 'result') {
      return null;
    }

    // stream_event（部分レスポンス）はスキップ
    if (event.type === 'stream_event') {
      return null;
    }

    return null;
  }, [event, toolResultMap]);

  if (!parsed) return null;

  const isUser = parsed.role === 'user';
  const isSystem = parsed.role === 'system';

  return (
    <div className={cn('py-3', isUser && 'flex justify-end')}>
      <div
        className={cn(
          'text-sm whitespace-pre-wrap break-words',
          isUser && 'bg-muted rounded-2xl px-4 py-2 max-w-[80%] text-foreground',
          !isUser && 'text-foreground w-full',
          isSystem && 'text-muted-foreground text-xs'
        )}
      >
        {parsed.contents.map((content, index) => {
          if (content.type === 'text') {
            // assistant メッセージのテキストには黒丸を追加し、Markdown でレンダリング
            if (parsed.role === 'assistant') {
              return (
                <div key={index} className="flex items-start gap-1 py-1">
                  <Circle className="h-2 w-2 fill-current flex-shrink-0 mt-2" />
                  <div className="flex-1 min-w-0">
                    <MarkdownContent content={content.text} />
                  </div>
                </div>
              );
            }
            return <div key={index}>{content.text}</div>;
          }

          if (content.type === 'tool_use') {
            return (
              <ToolUseBlock
                key={content.toolUse.id}
                name={content.toolUse.name}
                input={content.toolUse.input}
                result={content.result}
                childEvents={childEventsMap.get(content.toolUse.id)}
                toolResultMap={toolResultMap}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
