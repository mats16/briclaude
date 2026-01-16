import { useMemo } from 'react';
import type { SDKMessage, ImageContentBlock as ImageContentBlockType } from '@repo/types';
import {
  isSDKUserMessageEvent,
  isSDKAssistantMessageEvent,
  isSDKSystemMessageEvent,
  isTextContentBlock,
  isToolUseContentBlock,
  isImageContentBlock,
} from '@repo/types';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolUseBlock } from './tool-use';
import { MarkdownContent } from './MarkdownContent';
import {
  extractToolUseBlocksAsMap,
  type ToolResult,
  type ToolUseBlock as ToolUseBlockType,
} from '@/lib/message-utils';

// XSS対策: 許可されたメディアタイプのホワイトリスト
const ALLOWED_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

/**
 * 安全な画像 data URL を生成する
 * media_type と data を検証してからURLを構築
 */
function createSafeImageDataUrl(source: ImageContentBlockType['source']): string | null {
  const { media_type, data } = source;

  // media_type のホワイトリスト検証
  if (!ALLOWED_IMAGE_MEDIA_TYPES.has(media_type)) {
    console.warn(`Invalid media type rejected: ${media_type}`);
    return null;
  }

  // data が有効な base64 文字列かチェック（基本的なバリデーション）
  if (typeof data !== 'string' || data.length === 0) {
    console.warn('Invalid image data');
    return null;
  }

  // base64文字列に不正な文字が含まれていないか確認
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(data)) {
    console.warn('Invalid base64 data');
    return null;
  }

  return `data:${media_type};base64,${data}`;
}

interface EventItemProps {
  event: SDKMessage;
  toolResultMap: Map<string, ToolResult>;
  childEventsMap: Map<string, SDKMessage[]>;
}

interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  source: ImageContentBlockType['source'];
}

interface ToolUseContent {
  type: 'tool_use';
  toolUse: ToolUseBlockType;
  result?: ToolResult;
}

type ContentBlock = TextContent | ImageContent | ToolUseContent;

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
        const contents: ContentBlock[] = [];

        for (const block of content) {
          if (isImageContentBlock(block)) {
            contents.push({ type: 'image', source: block.source });
          } else if (isTextContentBlock(block)) {
            contents.push({ type: 'text', text: block.text });
          }
          // tool_result は除外
        }

        // コンテンツがある場合のみ表示
        if (contents.length > 0) {
          return { role: 'user', contents };
        }
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
          if (content.type === 'image') {
            const safeDataUrl = createSafeImageDataUrl(content.source);
            if (!safeDataUrl) {
              return (
                <div
                  key={index}
                  className="max-w-[300px] p-4 bg-muted rounded-lg mb-2 text-muted-foreground text-xs"
                >
                  Invalid image format
                </div>
              );
            }
            return (
              <img
                key={index}
                src={safeDataUrl}
                alt="User attached"
                className="max-w-[300px] max-h-[300px] rounded-lg mb-2"
              />
            );
          }

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
