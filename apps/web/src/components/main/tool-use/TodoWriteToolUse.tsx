import { useTranslation } from 'react-i18next';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BaseToolUseProps } from './types';

interface TodoItem {
  status?: 'pending' | 'in_progress' | 'completed';
  content?: string;
  activeForm?: string;
}

export function TodoWriteToolUse({ input, result }: BaseToolUseProps) {
  const { t } = useTranslation();

  const isRunning = !result;
  const isSuccess = result && !result.isError;
  const isError = result?.isError;

  const todos = Array.isArray(input.todos) ? (input.todos as TodoItem[]) : [];

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
        <span className="font-bold text-sm flex-shrink-0">{t('tools.updateTodos')}</span>
      </div>
      <TodoList todos={todos} />
    </div>
  );
}

interface TodoListProps {
  todos: TodoItem[];
}

function TodoList({ todos }: TodoListProps) {
  if (!todos || todos.length === 0) {
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
