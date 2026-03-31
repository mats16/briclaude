import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * イベントバッチバッファのアイテム型
 */
export interface SessionEventJobPayload {
  userId: string;
  sessionId: string;
  eventUuid: string;
  type: string;
  subtype: string | null;
  message: SDKMessage;
  /** EventBatcher.add() で割り当てられる。リトライ時も元の時刻を保持する */
  enqueuedAt?: Date;
}
