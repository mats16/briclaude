import type { SDKUserMessage } from '@repo/types';

export interface NewSessionNavigationState {
  initialMessage: SDKUserMessage;
}

export function isNewSessionNavigationState(state: unknown): state is NewSessionNavigationState {
  if (typeof state !== 'object' || state === null) return false;
  const s = state as Record<string, unknown>;
  return (
    typeof s.initialMessage === 'object' &&
    s.initialMessage !== null &&
    (s.initialMessage as Record<string, unknown>).type === 'user'
  );
}
