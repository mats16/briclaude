/**
 * WebSocket 関連の型定義
 */

import type { SessionEventData } from './session.js';

// SessionEventData を re-export（WebSocket でも使用）
export type { SessionEventData };

/**
 * @deprecated Use SessionEventData instead
 */
export type WsSessionEvent = SessionEventData;

/**
 * WebSocket 接続時のサーバーからの初期メッセージ
 */
export interface WsConnectedMessage {
  type: 'connected';
  session_id: string;
  last_seq: number;
}

/**
 * WebSocket エラーメッセージ
 */
export interface WsErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

/**
 * WebSocket Pong メッセージ
 */
export interface WsPongMessage {
  type: 'pong';
}

/**
 * WebSocket サーバー -> クライアントメッセージ
 */
export type WsServerMessage = WsConnectedMessage | WsSessionEvent | WsErrorMessage | WsPongMessage;

/**
 * WebSocket クライアント -> サーバーメッセージ
 */
export interface WsClientMessage {
  type: 'ping';
}
