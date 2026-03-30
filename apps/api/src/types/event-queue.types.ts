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
  createdAt: string;
}
