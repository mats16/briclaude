import { useState, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();

  const { displayContent, shouldCollapse, hiddenLines } = useMemo(() => {
    if (!content) {
      return { displayContent: '', shouldCollapse: false, hiddenLines: 0 };
    }

    if (content.length <= maxChars) {
      return { displayContent: content, shouldCollapse: false, hiddenLines: 0 };
    }

    // maxChars 以内に収まる行数を計算
    const lines = content.split('\n');
    let visibleLines = 0;
    let charCount = 0;

    for (const line of lines) {
      const lineLength = line.length + (visibleLines > 0 ? 1 : 0);
      if (charCount + lineLength > maxChars) break;
      charCount += lineLength;
      visibleLines++;
    }

    return {
      displayContent: visibleLines > 0 ? lines.slice(0, visibleLines).join('\n') : '',
      shouldCollapse: true,
      hiddenLines: lines.length - visibleLines,
    };
  }, [content, maxChars]);

  if (!content) return null;

  const visibleContent = isExpanded ? content : displayContent;
  const hasVisibleContent = visibleContent.length > 0;

  const handleToggle = () => setIsExpanded(prev => !prev);

  const toggleLabel = isExpanded
    ? t('tools.collapse')
    : t('tools.expandLines', { count: hiddenLines });

  const toggleAriaLabel = isExpanded
    ? t('tools.collapseContent')
    : t('tools.showRemainingLinesContent', { count: hiddenLines });

  // 表示するものがない場合は null を返す
  if (!hasVisibleContent && !shouldCollapse) return null;

  return (
    <div className="mt-1 ml-4">
      <div className="flex items-start gap-1 text-muted-foreground">
        <span className="select-none" aria-hidden="true">
          └─
        </span>
        {hasVisibleContent ? (
          <pre
            id={contentId}
            className={cn(
              'text-xs font-mono whitespace-pre-wrap break-all flex-1',
              isError && 'text-destructive'
            )}
          >
            {visibleContent}
          </pre>
        ) : (
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isExpanded}
            aria-controls={contentId}
            aria-label={toggleAriaLabel}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {toggleLabel}
          </button>
        )}
      </div>
      {shouldCollapse && hasVisibleContent && (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          aria-label={toggleAriaLabel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-6"
        >
          {toggleLabel}
        </button>
      )}
    </div>
  );
}
