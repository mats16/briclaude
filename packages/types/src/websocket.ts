/**
 * WebSocket 関連の型定義
 */

/**
 * WebSocket イベント型（SDK Message をラップ）
 * session_events.message と同一の構造
 */
export interface WsSessionEvent {
  /** イベント連番 */
  seq: number;
  /** イベント UUID */
  uuid: string;
  /** イベントタイプ（user, assistant, system, result など） */
  type: string;
  /** サブタイプ（init, status, success, error など） */
  subtype: string | null;
  /** SDK Message そのまま */
  message: unknown;
  /** 作成日時 */
  created_at: string;
}

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
export type WsServerMessage =
  | WsConnectedMessage
  | WsSessionEvent
  | WsErrorMessage
  | WsPongMessage;

/**
 * WebSocket クライアント -> サーバーメッセージ
 */
export interface WsClientMessage {
  type: 'ping';
}
