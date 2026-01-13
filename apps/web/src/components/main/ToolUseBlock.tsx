import { useState, useId } from 'react';
import type { SDKMessage } from '@repo/types';
import { Circle } from 'lucide-react';
import { CollapsibleContent } from './CollapsibleContent';
import {
  getToolInputDisplay,
  extractNestedToolUses,
  countNestedToolUses,
  type ToolResult,
} from '@/lib/message-utils';
import { cn } from '@/lib/utils';

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
  const inputDisplay = getToolInputDisplay(name, input);
  const isTaskTool = name.toLowerCase() === 'task';

  // ドットの色を状態に応じて変更
  const isRunning = !result;
  const isSuccess = result && !result.isError;
  const isError = result?.isError;

  // Task ツールの場合、子イベントからネストされたツール使用を抽出
  const hasChildEvents = childEvents && childEvents.length > 0;
  const nestedToolCount = hasChildEvents ? countNestedToolUses(childEvents) : 0;

  return (
    <div className="py-1">
      <div className="flex items-center gap-1">
        <Circle
          aria-hidden="true"
          className={cn(
            'h-2 w-2 fill-current flex-shrink-0',
            isRunning && 'text-foreground animate-pulse',
            isSuccess && 'text-green-500',
            isError && 'text-red-500'
          )}
        />
        <span className="font-bold text-sm">{name}</span>
        <span className="text-sm text-muted-foreground font-mono truncate">{inputDisplay}</span>
      </div>

      {/* Task ツールの場合は子イベントをネスト表示 */}
      {isTaskTool && hasChildEvents ? (
        <TaskChildContent
          childEvents={childEvents}
          toolResultMap={toolResultMap}
          toolCount={nestedToolCount}
        />
      ) : (
        result && <CollapsibleContent content={result.content} isError={result.isError} />
      )}
    </div>
  );
}

interface TaskChildContentProps {
  childEvents: SDKMessage[];
  toolResultMap: Map<string, ToolResult>;
  toolCount: number;
}

function TaskChildContent({ childEvents, toolResultMap, toolCount }: TaskChildContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();
  const nestedTools = extractNestedToolUses(childEvents, toolResultMap);

  const summaryText = `${toolCount}個のツール使用`;

  return (
    <div className="mt-1 ml-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-label={isExpanded ? 'ツール使用の詳細を折りたたむ' : `${toolCount}個のツール使用の詳細を表示`}
        className="flex items-start gap-1 text-muted-foreground hover:text-foreground transition-colors text-left w-full"
      >
        <span className="select-none" aria-hidden="true">└</span>
        <span className="text-xs">{summaryText}</span>
      </button>

      {isExpanded && (
        <div id={contentId} className="ml-4 mt-2 space-y-1 border-l border-border pl-3">
          {nestedTools.map((tool, index) => (
            <NestedToolItem key={index} tool={tool} />
          ))}
        </div>
      )}
    </div>
  );
}

interface NestedToolItemProps {
  tool: {
    name: string;
    input: string;
    result?: string;
    isError?: boolean;
  };
}

function NestedToolItem({ tool }: NestedToolItemProps) {
  const [isResultExpanded, setIsResultExpanded] = useState(false);
  const resultId = useId();
  const hasResult = tool.result && tool.result.length > 0;
  const shouldCollapseResult = hasResult && tool.result!.length > 200;
  const hiddenChars = shouldCollapseResult ? tool.result!.length - 200 : 0;

  return (
    <div className="py-0.5">
      <div className="flex items-center gap-1">
        <Circle
          aria-hidden="true"
          className={cn(
            'h-2 w-2 fill-current flex-shrink-0',
            tool.isError ? 'text-red-500' : 'text-green-500'
          )}
        />
        <span className="font-bold text-xs">{tool.name}</span>
        <span className="text-xs text-muted-foreground font-mono truncate">{tool.input}</span>
      </div>

      {hasResult && (
        <div className="ml-4 mt-0.5">
          <pre
            id={resultId}
            className={cn(
              'text-xs font-mono whitespace-pre-wrap break-all',
              tool.isError ? 'text-destructive' : 'text-muted-foreground'
            )}
          >
            {shouldCollapseResult && !isResultExpanded ? tool.result!.slice(0, 200) : tool.result}
          </pre>
          {shouldCollapseResult && (
            <button
              type="button"
              onClick={() => setIsResultExpanded(!isResultExpanded)}
              aria-expanded={isResultExpanded}
              aria-controls={resultId}
              aria-label={isResultExpanded ? '結果を折りたたむ' : `残り ${hiddenChars} 文字を表示`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isResultExpanded ? '折りたたむ' : `... +${hiddenChars} 文字`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
