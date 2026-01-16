import { useState, useId, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface CollapsibleContentProps {
  content: string;
  isError?: boolean;
  /** 折り畳む文字数の閾値 */
  maxChars?: number;
}

export function CollapsibleContent({
  content,
  isError = false,
  maxChars = 250,
}: CollapsibleContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  const { displayContent, shouldCollapse, hiddenLines } = useMemo(() => {
    // content が undefined または空の場合
    if (!content) {
      return { displayContent: '', shouldCollapse: false, hiddenLines: 0 };
    }

    const totalChars = content.length;

    // 250文字以下なら折り畳まない
    if (totalChars <= maxChars) {
      return { displayContent: content, shouldCollapse: false, hiddenLines: 0 };
    }

    // 250文字以内に収まる行数を計算
    const lines = content.split('\n');
    const totalLines = lines.length;
    let visibleLines = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + (i > 0 ? 1 : 0); // 改行文字を含む
      if (charCount + lineLength > maxChars) {
        break;
      }
      charCount += lineLength;
      visibleLines++;
    }

    return {
      displayContent: visibleLines > 0 ? lines.slice(0, visibleLines).join('\n') : '',
      shouldCollapse: true,
      hiddenLines: totalLines - visibleLines,
    };
  }, [content, maxChars]);

  // content が undefined または空の場合は何も表示しない
  if (!content) {
    return null;
  }

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
          {isExpanded ? content : displayContent}
        </pre>
      </div>
      {shouldCollapse && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          aria-label={isExpanded ? 'コンテンツを折りたたむ' : `残り ${hiddenLines} 行を表示`}
          className="ml-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? '折りたたむ' : `... +${hiddenLines} 行`}
        </button>
      )}
    </div>
  );
}
