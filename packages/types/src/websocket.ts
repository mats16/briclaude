/**
 * WebSocket 関連の型定義
 */

import type { SDKMessage } from './session.js';

// SDKMessage を re-export（WebSocket でも使用）
export type { SDKMessage };

/**
 * WebSocket 接続時のサーバーからの初期メッセージ
 */
export interface WsConnectedMessage {
  type: 'connected';
  session_id: string;
  last_event_id: string | null;
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
export type WsServerMessage = WsConnectedMessage | SDKMessage | WsErrorMessage | WsPongMessage;

/**
 * WebSocket クライアント -> サーバーメッセージ
 */
export interface WsClientMessage {
  type: 'ping';
}
