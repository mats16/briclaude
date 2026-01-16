import { useTranslation } from 'react-i18next';
import { BaseToolUse } from './BaseToolUse';
import { CollapsibleContent } from '../CollapsibleContent';
import type { BaseToolUseProps } from './types';

export function ReadToolUse({ name, input, result }: BaseToolUseProps) {
  const { t } = useTranslation();

  const lineCount = result?.content ? result.content.split('\n').length : 0;

  return (
    <BaseToolUse name={name} input={input} result={result}>
      {result && !result.isError && (
        <div className="mt-1 ml-4">
          <div className="flex items-start gap-1 text-muted-foreground">
            <span className="select-none" aria-hidden="true">
              └
            </span>
            <span className="text-xs font-mono">{t('tools.readLines', { count: lineCount })}</span>
          </div>
        </div>
      )}
      {result?.isError && <CollapsibleContent content={result.content} isError />}
    </BaseToolUse>
  );
}
