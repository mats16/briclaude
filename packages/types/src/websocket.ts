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
 * Abort リクエスト（クライアント -> サーバー）
 */
export interface WsAbortRequest {
  subtype: 'abort';
}

/**
 * Control リクエスト（クライアント -> サーバー）
 */
export interface WsControlRequest {
  type: 'control_request';
  request_id: string;
  request: WsAbortRequest;
}

/**
 * Control 成功レスポンス
 */
export interface WsControlSuccessResponse {
  subtype: 'success';
  request_id: string;
}

/**
 * Control エラーレスポンス
 */
export interface WsControlErrorResponse {
  subtype: 'error';
  request_id: string;
  error: string;
}

/**
 * Control レスポンス（サーバー -> クライアント）
 */
export interface WsControlResponse {
  type: 'control_response';
  response: WsControlSuccessResponse | WsControlErrorResponse;
}

/**
 * WebSocket サーバー -> クライアントメッセージ
 */
export type WsServerMessage =
  | WsConnectedMessage
  | SDKMessage
  | SDKAuthStatusMessage
  | WsErrorMessage
  | WsControlResponse;

/**
 * WebSocket KeepAlive メッセージ（クライアント -> サーバー）
 */
export interface WsKeepAliveMessage {
  type: 'keep_alive';
}

/**
 * WebSocket クライアント -> サーバーメッセージ
 */
export type WsClientMessage = WsKeepAliveMessage | SDKUserMessage | WsControlRequest;
