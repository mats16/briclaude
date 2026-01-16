import { useState, useId } from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleContentProps {
  content: string;
  isError?: boolean;
  collapsedChars?: number;
}

export function CollapsibleContent({
  content,
  isError = false,
  collapsedChars = 200,
}: CollapsibleContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  // content が undefined または空の場合は何も表示しない
  if (!content) {
    return null;
  }

  const totalChars = content.length;
  const shouldCollapse = totalChars > collapsedChars;
  const hiddenChars = totalChars - collapsedChars;

  const displayContent = shouldCollapse && !isExpanded ? content.slice(0, collapsedChars) : content;

  return (
    <div className="mt-1 ml-4">
      <div className="flex items-start gap-1 text-muted-foreground">
        <span className="select-none" aria-hidden="true">
          └─
        </span>
        <pre
          id={contentId}
          className={cn(
            'text-xs font-mono whitespace-pre-wrap break-all flex-1',
            isError && 'text-destructive'
          )}
        >
          {displayContent}
        </pre>
      </div>
      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          aria-label={isExpanded ? 'コンテンツを折りたたむ' : `残り ${hiddenChars} 文字を表示`}
          className="ml-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? '折りたたむ' : `... +${hiddenChars} 文字`}
        </button>
      )}
    </div>
  );
}
