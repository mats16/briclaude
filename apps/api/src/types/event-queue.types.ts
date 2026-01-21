import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * pg-boss キューに送信するジョブペイロード
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

/**
 * セッションイベント挿入用のキュー名
 */
export const SESSION_EVENTS_QUEUE = 'session-events-insert';
