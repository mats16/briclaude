import { useMemo } from 'react';
import { BaseToolUse } from './BaseToolUse';
import { DiffDisplay, computeNewFileDiff } from './DiffView';
import { CollapsibleContent } from '../CollapsibleContent';
import type { BaseToolUseProps } from './types';

export function WriteToolUse({ name, input, result }: BaseToolUseProps) {
  const content = typeof input.content === 'string' ? input.content : '';
  const filePath = typeof input.file_path === 'string' ? input.file_path : undefined;

  const diffLines = useMemo(() => computeNewFileDiff(content), [content]);

  return (
    <BaseToolUse name={name} input={input} result={result}>
      {result && !result.isError && diffLines.length > 0 && (
        <DiffDisplay lines={diffLines} filePath={filePath} />
      )}
      {result?.isError && <CollapsibleContent content={result.content} isError />}
    </BaseToolUse>
  );
}
