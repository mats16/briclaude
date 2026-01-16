import { BaseToolUse } from './BaseToolUse';
import { CollapsibleContent } from '../CollapsibleContent';
import type { BaseToolUseProps } from './types';

export function DefaultToolUse({ name, input, result }: BaseToolUseProps) {
  return (
    <BaseToolUse name={name} input={input} result={result}>
      {result && <CollapsibleContent content={result.content} isError={result.isError} />}
    </BaseToolUse>
  );
}
