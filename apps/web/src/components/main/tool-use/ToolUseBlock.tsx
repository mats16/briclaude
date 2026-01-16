import type { SDKMessage } from '@repo/types';
import { WriteToolUse } from './WriteToolUse';
import { EditToolUse } from './EditToolUse';
import { ReadToolUse } from './ReadToolUse';
import { TodoWriteToolUse } from './TodoWriteToolUse';
import { TaskToolUse } from './TaskToolUse';
import { DefaultToolUse } from './DefaultToolUse';
import type { ToolResult } from './types';

interface ToolUseBlockProps {
  name: string;
  input: Record<string, unknown>;
  result?: ToolResult;
  childEvents?: SDKMessage[];
  toolResultMap: Map<string, ToolResult>;
}

export function ToolUseBlock({
  name,
  input,
  result,
  childEvents,
  toolResultMap,
}: ToolUseBlockProps) {
  const lowerName = name.toLowerCase();

  switch (lowerName) {
    case 'write':
      return <WriteToolUse name={name} input={input} result={result} />;

    case 'edit':
      return <EditToolUse name={name} input={input} result={result} />;

    case 'read':
      return <ReadToolUse name={name} input={input} result={result} />;

    case 'todowrite':
      return <TodoWriteToolUse name={name} input={input} result={result} />;

    case 'task':
      return (
        <TaskToolUse
          name={name}
          input={input}
          result={result}
          childEvents={childEvents}
          toolResultMap={toolResultMap}
        />
      );

    default:
      return <DefaultToolUse name={name} input={input} result={result} />;
  }
}
