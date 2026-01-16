import { BaseToolUse } from './BaseToolUse';
import { DiffView } from './DiffView';
import { CollapsibleContent } from '../CollapsibleContent';
import type { BaseToolUseProps } from './types';

export function EditToolUse({ name, input, result }: BaseToolUseProps) {
  const oldString = typeof input.old_string === 'string' ? input.old_string : '';
  const newString = typeof input.new_string === 'string' ? input.new_string : '';
  const filePath = typeof input.file_path === 'string' ? input.file_path : undefined;

  const hasDiff = oldString || newString;

  return (
    <BaseToolUse name={name} input={input} result={result}>
      {result && !result.isError && hasDiff && (
        <DiffView oldText={oldString} newText={newString} filePath={filePath} />
      )}
      {result?.isError && <CollapsibleContent content={result.content} isError />}
    </BaseToolUse>
  );
}
