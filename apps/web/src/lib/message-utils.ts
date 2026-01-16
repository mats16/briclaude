import type { SDKMessage } from '@repo/types';
import {
  isSDKUserMessageEvent,
  isSDKAssistantMessageEvent,
  isToolResultContentBlock,
  isToolUseContentBlock,
  hasParentToolUseId,
} from '@repo/types';

export interface ToolResult {
  content: string;
  isError: boolean;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * SDKMessage[] から tool_result を抽出して Map に格納
 */
export function extractToolResults(events: SDKMessage[]): Map<string, ToolResult> {
  const toolResultMap = new Map<string, ToolResult>();

  for (const event of events) {
    if (!isSDKUserMessageEvent(event)) continue;

    const content = event.message.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (isToolResultContentBlock(block)) {
        toolResultMap.set(block.tool_use_id, {
          content:
            typeof block.content === 'string'
              ? block.content
              : block.content != null
                ? JSON.stringify(block.content)
                : '',
          isError: block.is_error ?? false,
        });
      }
    }
  }

  return toolResultMap;
}

/**
 * assistant メッセージの content から tool_use ブロックを抽出
 */
export function extractToolUseBlocks(assistantMsg: SDKMessage): ToolUseBlock[] {
  const toolUses: ToolUseBlock[] = [];

  if (!isSDKAssistantMessageEvent(assistantMsg)) return toolUses;

  const content = assistantMsg.message.content;
  if (!Array.isArray(content)) return toolUses;

  for (const block of content) {
    if (isToolUseContentBlock(block)) {
      toolUses.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  }

  return toolUses;
}

/**
 * assistant メッセージの content から tool_use ブロックを Map として抽出
 * ID をキーとしてアクセスできるため、ループ内での検索が O(1) になる
 */
export function extractToolUseBlocksAsMap(assistantMsg: SDKMessage): Map<string, ToolUseBlock> {
  const toolUseMap = new Map<string, ToolUseBlock>();

  if (!isSDKAssistantMessageEvent(assistantMsg)) return toolUseMap;

  const content = assistantMsg.message.content;
  if (!Array.isArray(content)) return toolUseMap;

  for (const block of content) {
    if (isToolUseContentBlock(block)) {
      toolUseMap.set(block.id, {
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  }

  return toolUseMap;
}

/**
 * ToolUseContentBlock から id を取得（型安全）
 */
export function getToolUseId(block: unknown): string | null {
  if (isToolUseContentBlock(block)) {
    return block.id;
  }
  return null;
}

/**
 * ツール別の入力表示を取得
 */
export function getToolInputDisplay(name: string, input: Record<string, unknown>): string {
  const lowerName = name.toLowerCase();

  switch (lowerName) {
    case 'bash':
      return typeof input.command === 'string' ? input.command : '';
    case 'read':
      return typeof input.file_path === 'string' ? input.file_path : '';
    case 'write':
    case 'edit':
      return typeof input.file_path === 'string' ? input.file_path : '';
    case 'glob':
      return typeof input.pattern === 'string' ? input.pattern : '';
    case 'grep':
      return typeof input.pattern === 'string' ? input.pattern : '';
    case 'task':
      return typeof input.description === 'string' ? input.description : '';
    case 'skill':
      return typeof input.skill === 'string' ? input.skill : '';
    case 'mcp__sql__execute_sql_read_only':
    case 'mcp__sql__execute_sql':
      return typeof input.query === 'string' ? input.query : '';
    case 'todowrite':
      if (Array.isArray(input.todos)) {
        return input.todos
          .map((todo: { status?: string; content?: string }) => {
            const status =
              todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '→' : '○';
            return `${status} ${todo.content ?? ''}`;
          })
          .join('\n');
      }
      return '';
    default:
      return JSON.stringify(input);
  }
}

/**
 * 子イベント（parent_tool_use_id を持つイベント）をグループ化
 */
export function groupChildEvents(events: SDKMessage[]): Map<string, SDKMessage[]> {
  const childEventsMap = new Map<string, SDKMessage[]>();

  for (const event of events) {
    if (hasParentToolUseId(event)) {
      const parentToolUseId = event.parent_tool_use_id;
      const existing = childEventsMap.get(parentToolUseId) ?? [];
      existing.push(event);
      childEventsMap.set(parentToolUseId, existing);
    }
  }

  return childEventsMap;
}

/**
 * 子イベントからネストされたツール使用を抽出
 */
export interface NestedToolUse {
  name: string;
  input: string;
  result?: string;
  isError?: boolean;
}

export function extractNestedToolUses(
  childEvents: SDKMessage[],
  toolResultMap: Map<string, ToolResult>
): NestedToolUse[] {
  const tools: NestedToolUse[] = [];

  for (const event of childEvents) {
    if (!isSDKAssistantMessageEvent(event)) continue;

    const toolBlocks = extractToolUseBlocks(event);
    for (const toolBlock of toolBlocks) {
      const result = toolResultMap.get(toolBlock.id);
      tools.push({
        name: toolBlock.name,
        input: getToolInputDisplay(toolBlock.name, toolBlock.input),
        result: result?.content,
        isError: result?.isError,
      });
    }
  }

  return tools;
}

/**
 * 子イベントのツール使用数をカウント
 */
export function countNestedToolUses(childEvents: SDKMessage[]): number {
  let count = 0;

  for (const event of childEvents) {
    if (!isSDKAssistantMessageEvent(event)) continue;

    const toolBlocks = extractToolUseBlocks(event);
    count += toolBlocks.length;
  }

  return count;
}
