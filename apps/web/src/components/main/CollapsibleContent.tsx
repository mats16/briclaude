import { useState } from 'react';
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
  const totalChars = content.length;
  const shouldCollapse = totalChars > collapsedChars;
  const hiddenChars = totalChars - collapsedChars;

  const displayContent = shouldCollapse && !isExpanded ? content.slice(0, collapsedChars) : content;

  return (
    <div className="mt-1 ml-4">
      <div className="flex items-start gap-1 text-muted-foreground">
        <span className="select-none">└─</span>
        <pre
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
          className="ml-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? '折りたたむ' : `... +${hiddenChars} 文字`}
        </button>
      )}
    </div>
  );
}
