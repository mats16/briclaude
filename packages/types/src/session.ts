// =====================================================
// Session Status Types
// =====================================================

export type SessionStatus = 'init' | 'running' | 'idle' | 'error' | 'archived';

// =====================================================
// Source/Outcome Types
// =====================================================

export interface DatabricksWorkspaceSource {
  type: 'databricks_workspace';
  path: string;
}

export type SessionSource = DatabricksWorkspaceSource;
export type SessionOutcome = DatabricksWorkspaceSource;

// =====================================================
// Session Context Types
// =====================================================

/**
 * セッション作成リクエスト用のコンテキスト
 */
export interface SessionCreateContext {
  model: 'opus' | 'sonnet' | 'haiku';
  sources: SessionSource[];
  outcomes: SessionOutcome[];
}

/**
 * セッションレスポンス用のコンテキスト（DBに保存される形式）
 */
export interface SessionContextResponse {
  allowed_tools: string[];
  disallowed_tools: string[];
  cwd: string;
  model: string;
  sources: SessionSource[];
  outcomes: SessionOutcome[];
}

// =====================================================
// Session Create Event Types
// =====================================================

export interface SessionCreateEventData {
  uuid: string;
  session_id: string;
  type: 'user';
  parent_tool_use_id: string | null;
  message: {
    role: 'user';
    content: string;
  };
}

export interface SessionCreateEvent {
  type: 'event';
  data: SessionCreateEventData;
}

// =====================================================
// Session Create Request/Response Types
// =====================================================

export interface SessionCreateRequest {
  title?: string;
  events: SessionCreateEvent[];
  session_context: SessionCreateContext;
}

export interface SessionCreateResponse {
  id: string;
  session_status: SessionStatus;
  title: string | null;
  created_at: string;
  updated_at: string;
  session_context: SessionContextResponse;
}

// =====================================================
// Session Summary/Detail Types
// =====================================================

export interface SessionSummary {
  id: string;
  title: string | null;
  session_status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetail extends SessionSummary {
  sdkSessionId: string | null;
  sessionContext: SessionContextResponse | null;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
}

// =====================================================
// Session Events Types (GET /api/sessions/:id/events)
// =====================================================

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

// SDK Message 型を re-export
export type { SDKMessage };

/**
 * セッションイベント（REST API / WebSocket 共通）
 */
export interface SessionEventData {
  /** イベント UUID */
  uuid: string;
  /** イベントタイプ（user, assistant, system, result など） */
  type: string;
  /** サブタイプ（init, status, success, error など） */
  subtype?: string;
  /** SDK Message データ */
  data: SDKMessage;
}

/**
 * GET /api/sessions/:session_id/events のクエリパラメータ
 */
export interface SessionEventsQuery {
  /** 取得開始位置（この uuid より後のイベントを取得） */
  after?: string;
  /** 取得件数上限（デフォルト: 100） */
  limit?: number;
}

/**
 * GET /api/sessions/:session_id/events のレスポンス
 */
export interface SessionEventsResponse {
  data: SessionEventData[];
  first_id: string;
  last_id: string;
  has_more: boolean;
}

// =====================================================
// Message Types
// =====================================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

// =====================================================
// Legacy Types (後方互換性のため残す)
// =====================================================

export interface UserMessageContentBlock {
  type: 'text';
  text: string;
}

export interface UserMessage {
  role: 'user';
  content: UserMessageContentBlock[];
}

/**
 * @deprecated Use SessionCreateEvent instead
 */
export interface SessionStartEvent {
  uuid: string;
  type: 'user';
  message: UserMessage;
}

/**
 * @deprecated Use SessionCreateContext instead
 */
export interface SessionContext {
  model: 'opus' | 'sonnet' | 'haiku';
  databricksWorkspacePath: string | null;
  databricksWorkspaceAutoPush: boolean;
}

/**
 * @deprecated Use SessionCreateRequest instead
 */
export interface SessionStartRequest {
  events: SessionStartEvent[];
  session_context: SessionContext;
}

/**
 * @deprecated Use SessionCreateResponse instead
 */
export interface SessionStartResponse {
  session_id: string;
  sdk_session_id: string | null;
  error?: unknown;
}

/**
 * @deprecated Use SessionCreateRequest instead
 */
export interface CreateSessionRequest {
  title?: string;
}

/**
 * @deprecated Use SessionCreateResponse instead
 */
export interface CreateSessionResponse {
  session: SessionDetail;
}
