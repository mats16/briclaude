import type { SDKMessage } from '@repo/types';

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
    if (event.type !== 'user') continue;

    const userMsg = event as { message?: { content?: unknown[] } };
    const content = userMsg.message?.content;

    if (!Array.isArray(content)) continue;

    for (const block of content) {
      const resultBlock = block as {
        type?: string;
        tool_use_id?: string;
        content?: string;
        is_error?: boolean;
      };

      if (resultBlock.type === 'tool_result' && resultBlock.tool_use_id) {
        toolResultMap.set(resultBlock.tool_use_id, {
          content:
            typeof resultBlock.content === 'string'
              ? resultBlock.content
              : JSON.stringify(resultBlock.content),
          isError: resultBlock.is_error ?? false,
        });
      }
    }
  }

  return toolResultMap;
}

/**
 * assistant メッセージの content から tool_use ブロックを抽出
 */
export function extractToolUseBlocks(
  assistantMsg: Record<string, unknown>
): ToolUseBlock[] {
  const toolUses: ToolUseBlock[] = [];

  // message.content を確認
  const message = assistantMsg.message as { content?: unknown[] } | undefined;
  const content = message?.content;

  if (!Array.isArray(content)) return toolUses;

  for (const block of content) {
    const toolBlock = block as {
      type?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    };

    if (
      toolBlock.type === 'tool_use' &&
      toolBlock.id &&
      toolBlock.name &&
      toolBlock.input
    ) {
      toolUses.push({
        type: 'tool_use',
        id: toolBlock.id,
        name: toolBlock.name,
        input: toolBlock.input,
      });
    }
  }

  return toolUses;
}

/**
 * ツール別の入力表示を取得
 */
export function getToolInputDisplay(
  name: string,
  input: Record<string, unknown>
): string {
  const lowerName = name.toLowerCase();

  switch (lowerName) {
    case 'bash':
      return (input.command as string) ?? '';
    case 'read':
      return (input.file_path as string) ?? '';
    case 'write':
    case 'edit':
      return (input.file_path as string) ?? '';
    case 'glob':
      return (input.pattern as string) ?? '';
    case 'grep':
      return (input.pattern as string) ?? '';
    case 'task':
      return (input.description as string) ?? '';
    default:
      return JSON.stringify(input);
  }
}

/**
 * 子イベント（parent_tool_use_id を持つイベント）をグループ化
 */
export function groupChildEvents(
  events: SDKMessage[]
): Map<string, SDKMessage[]> {
  const childEventsMap = new Map<string, SDKMessage[]>();

  for (const event of events) {
    const msg = event as Record<string, unknown>;
    const parentToolUseId = msg.parent_tool_use_id as string | null | undefined;

    if (parentToolUseId) {
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
    if (event.type !== 'assistant') continue;

    const toolBlocks = extractToolUseBlocks(event as Record<string, unknown>);
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
    if (event.type !== 'assistant') continue;

    const toolBlocks = extractToolUseBlocks(event as Record<string, unknown>);
    count += toolBlocks.length;
  }

  return count;
}
