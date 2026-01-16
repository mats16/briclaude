import { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const inputDisplay = getToolInputDisplay(name, input);
  const lowerName = name.toLowerCase();
  const isTaskTool = lowerName === 'task';
  const isTodoWriteTool = lowerName === 'todowrite';
  const isReadTool = lowerName === 'read';

  // ドットの色を状態に応じて変更
  const isRunning = !result;
  const isSuccess = result && !result.isError;
  const isError = result?.isError;

  // Task ツールの場合、子イベントからネストされたツール使用を抽出
  const hasChildEvents = childEvents && childEvents.length > 0;
  const nestedToolCount = hasChildEvents ? countNestedToolUses(childEvents) : 0;

  // TodoWrite ツールの場合の表示名とコンテンツ
  const displayName = isTodoWriteTool ? t('tools.updateTodos') : name;

  // Read ツールの場合は行数のみ表示
  const readLineCount = isReadTool && result?.content ? result.content.split('\n').length : 0;

  // TodoWrite ツールの場合は input.todos を表示
  if (isTodoWriteTool) {
    return (
      <div className="py-1">
        <div className="flex items-start gap-1">
          <Circle
            aria-hidden="true"
            className={cn(
              'h-2 w-2 fill-current flex-shrink-0 mt-1.5',
              isRunning && 'text-foreground animate-pulse',
              isSuccess && 'text-green-500',
              isError && 'text-red-500'
            )}
          />
          <span className="font-bold text-sm flex-shrink-0">{displayName}</span>
        </div>
        <TodoList todos={input.todos as TodoItem[]} />
      </div>
    );
  }

  // Read ツールの場合は行数のみ表示
  if (isReadTool) {
    return (
      <div className="py-1">
        <div className="flex items-start gap-1">
          <Circle
            aria-hidden="true"
            className={cn(
              'h-2 w-2 fill-current flex-shrink-0 mt-1.5',
              isRunning && 'text-foreground animate-pulse',
              isSuccess && 'text-green-500',
              isError && 'text-red-500'
            )}
          />
          <span className="font-bold text-sm flex-shrink-0">{name}</span>
          <span className="text-sm text-muted-foreground font-mono truncate">{inputDisplay}</span>
        </div>
        {result && !result.isError && (
          <div className="mt-1 ml-4">
            <div className="flex items-start gap-1 text-muted-foreground">
              <span className="select-none" aria-hidden="true">
                └
              </span>
              <span className="text-xs font-mono">
                {t('tools.readLines', { count: readLineCount })}
              </span>
            </div>
          </div>
        )}
        {result?.isError && <CollapsibleContent content={result.content} isError={true} />}
      </div>
    );
  }

  return (
    <div className="py-1">
      <div className="flex items-start gap-1">
        <Circle
          aria-hidden="true"
          className={cn(
            'h-2 w-2 fill-current flex-shrink-0 mt-1.5',
            isRunning && 'text-foreground animate-pulse',
            isSuccess && 'text-green-500',
            isError && 'text-red-500'
          )}
        />
        <span className="font-bold text-sm flex-shrink-0">{displayName}</span>
        <button
          type="button"
          onClick={() => setIsInputExpanded(!isInputExpanded)}
          className={cn(
            'text-sm text-muted-foreground font-mono text-left',
            isInputExpanded ? 'whitespace-pre-wrap break-all' : 'truncate'
          )}
        >
          {inputDisplay}
        </button>
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
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();
  const nestedTools = extractNestedToolUses(childEvents, toolResultMap);

  const summaryText = t('tools.toolUsesCount', { count: toolCount });

  return (
    <div className="mt-1 ml-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-label={
          isExpanded
            ? t('tools.collapseToolDetails')
            : t('tools.expandToolDetails', { count: toolCount })
        }
        className="flex items-start gap-1 text-muted-foreground hover:text-foreground transition-colors text-left w-full"
      >
        <span className="select-none" aria-hidden="true">
          └
        </span>
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
  const { t } = useTranslation();
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [isResultExpanded, setIsResultExpanded] = useState(false);
  const resultId = useId();
  const maxChars = 250;

  const hasResult = tool.result && tool.result.length > 0;

  const { displayResult, shouldCollapseResult, hiddenLines } = (() => {
    if (!hasResult) {
      return { displayResult: '', shouldCollapseResult: false, hiddenLines: 0 };
    }

    const totalChars = tool.result!.length;

    // 250文字以下なら折り畳まない
    if (totalChars <= maxChars) {
      return { displayResult: tool.result!, shouldCollapseResult: false, hiddenLines: 0 };
    }

    // 250文字以内に収まる行数を計算
    const lines = tool.result!.split('\n');
    const totalLines = lines.length;
    let visibleLines = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + (i > 0 ? 1 : 0);
      if (charCount + lineLength > maxChars) {
        break;
      }
      charCount += lineLength;
      visibleLines++;
    }

    return {
      displayResult: visibleLines > 0 ? lines.slice(0, visibleLines).join('\n') : '',
      shouldCollapseResult: true,
      hiddenLines: totalLines - visibleLines,
    };
  })();

  return (
    <div className="py-0.5">
      <div className="flex items-start gap-1">
        <Circle
          aria-hidden="true"
          className={cn(
            'h-2 w-2 fill-current flex-shrink-0 mt-1',
            tool.isError ? 'text-red-500' : 'text-green-500'
          )}
        />
        <span className="font-bold text-xs flex-shrink-0">{tool.name}</span>
        <button
          type="button"
          onClick={() => setIsInputExpanded(!isInputExpanded)}
          className={cn(
            'text-xs text-muted-foreground font-mono text-left',
            isInputExpanded ? 'whitespace-pre-wrap break-all' : 'truncate'
          )}
        >
          {tool.input}
        </button>
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
            {isResultExpanded ? tool.result : displayResult}
          </pre>
          {shouldCollapseResult && (
            <button
              type="button"
              onClick={() => setIsResultExpanded(!isResultExpanded)}
              aria-expanded={isResultExpanded}
              aria-controls={resultId}
              aria-label={
                isResultExpanded
                  ? t('tools.collapseResult')
                  : t('tools.showRemainingLines', { count: hiddenLines })
              }
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isResultExpanded
                ? t('tools.collapse')
                : t('tools.expandLines', { count: hiddenLines })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// TodoWrite 用の型とコンポーネント
interface TodoItem {
  status?: 'pending' | 'in_progress' | 'completed';
  content?: string;
  activeForm?: string;
}

interface TodoListProps {
  todos: TodoItem[] | undefined;
}

function TodoList({ todos }: TodoListProps) {
  if (!todos || !Array.isArray(todos) || todos.length === 0) {
    return null;
  }

  return (
    <div className="mt-1 ml-4">
      <div className="flex items-start gap-1 text-muted-foreground">
        <span className="select-none" aria-hidden="true">
          └
        </span>
        <ul className="text-xs font-mono space-y-0.5">
          {todos.map((todo, index) => {
            const isInProgress = todo.status === 'in_progress';
            const isCompleted = todo.status === 'completed';
            const displayText = isInProgress ? todo.activeForm : todo.content;
            const checkbox = isCompleted ? '☑' : '☐';

            return (
              <li key={index} className="flex items-start gap-1">
                <span>{checkbox}</span>
                <span
                  className={cn(isInProgress && 'text-foreground', isCompleted && 'line-through')}
                >
                  {displayText}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
