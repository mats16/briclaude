/**
 * WebSocket 関連の型定義
 */

import type { SDKMessage, SDKUserMessage, SDKAuthStatusMessage } from './session.js';

// SDKMessage, SDKUserMessage, SDKAuthStatusMessage を re-export（WebSocket でも使用）
export type { SDKMessage, SDKUserMessage, SDKAuthStatusMessage };

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
export type WsServerMessage =
  | WsConnectedMessage
  | SDKMessage
  | SDKAuthStatusMessage
  | WsErrorMessage
  | WsPongMessage;

/**
 * WebSocket Ping メッセージ（クライアント -> サーバー）
 */
export interface WsPingMessage {
  type: 'ping';
}

/**
 * WebSocket Interrupt メッセージ（クライアント -> サーバー）
 */
export interface WsInterruptMessage {
  type: 'control_request';
  request_id: string;
  request: {
    subtype: 'interrupt';
  };
}

/**
 * WebSocket クライアント -> サーバーメッセージ
 */
export type WsClientMessage = WsPingMessage | WsInterruptMessage | SDKUserMessage;
