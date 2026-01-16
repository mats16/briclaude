import { useState, type ReactNode } from 'react';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getToolInputDisplay } from '@/lib/message-utils';
import type { ToolResult } from './types';

interface BaseToolUseProps {
  name: string;
  displayName?: string;
  input: Record<string, unknown>;
  result?: ToolResult;
  children?: ReactNode;
  hideInput?: boolean;
}

export function BaseToolUse({
  name,
  displayName,
  input,
  result,
  children,
  hideInput = false,
}: BaseToolUseProps) {
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const inputDisplay = getToolInputDisplay(name, input);

  const isRunning = !result;
  const isSuccess = result && !result.isError;
  const isError = result?.isError;

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
        <span className="font-bold text-sm flex-shrink-0">{displayName ?? name}</span>
        {!hideInput && inputDisplay && (
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
        )}
      </div>
      {children}
    </div>
  );
}

interface StatusDotProps {
  isRunning: boolean;
  isSuccess: boolean;
  isError: boolean;
  className?: string;
}

export function StatusDot({ isRunning, isSuccess, isError, className }: StatusDotProps) {
  return (
    <Circle
      aria-hidden="true"
      className={cn(
        'h-2 w-2 fill-current flex-shrink-0',
        isRunning && 'text-foreground animate-pulse',
        isSuccess && 'text-green-500',
        isError && 'text-red-500',
        className
      )}
    />
  );
}
