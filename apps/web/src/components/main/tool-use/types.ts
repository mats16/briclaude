import type { SDKMessage } from '@repo/types';

export interface ToolResult {
  content: string;
  isError: boolean;
}

export interface BaseToolUseProps {
  name: string;
  input: Record<string, unknown>;
  result?: ToolResult;
}

export interface ToolUseBlockProps extends BaseToolUseProps {
  childEvents?: SDKMessage[];
  toolResultMap: Map<string, ToolResult>;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}
