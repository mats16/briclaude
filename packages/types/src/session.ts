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
  id: number;
}

export interface DatabricksAppsOutcome {
  type: 'databricks_apps';
  /** App name (generated server-side from session_id) */
  name?: string;
}

export type SessionSource = DatabricksWorkspaceSource;
export type SessionOutcome = DatabricksWorkspaceSource | DatabricksAppsOutcome;

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
  allowed_tools?: string[];
  disallowed_tools?: string[];
}

/**
 * セッションレスポンス用のコンテキスト（DBに保存される形式）
 */
export interface SessionContextResponse {
  allowed_tools?: string[];
  disallowed_tools?: string[];
  cwd: string;
  model: string;
  sources: SessionSource[];
  outcomes: SessionOutcome[];
}

// =====================================================
// Session Create Event Types
// =====================================================

import type { UserMessageContentBlock } from './message.js';

export interface SessionCreateEventData {
  uuid: string;
  session_id: string;
  type: 'user';
  parent_tool_use_id: string | null;
  message: {
    role: 'user';
    content: string | UserMessageContentBlock[];
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
// Session Response Types
// =====================================================

export interface SessionResponse {
  id: string;
  title: string | null;
  session_status: SessionStatus;
  created_at: string;
  updated_at: string;
  session_context: SessionContextResponse | null;
}

export interface SessionListResponse {
  data: SessionResponse[];
  first_id: string;
  last_id: string;
  has_more: boolean;
}

/**
 * GET /api/sessions のクエリパラメータ
 */
export interface SessionListQuery {
  /** 取得件数上限（デフォルト: 20、最大: 100） */
  limit?: number;
  /** ステータスでフィルタリング */
  status?: SessionStatus;
}

// =====================================================
// Session Archive Types (POST /api/sessions/:id/archive)
// =====================================================

/**
 * POST /api/sessions/:session_id/archive のレスポンス
 */
export type SessionArchiveResponse = SessionResponse;

// =====================================================
// Session Update Types (PATCH /api/sessions/:session_id)
// =====================================================

/**
 * PATCH /api/sessions/:session_id のリクエストボディ
 * ステータス変更は POST /api/sessions/:session_id/archive を使用してください
 */
export interface SessionUpdateRequest {
  /** セッションタイトル */
  title?: string;
}

// =====================================================
// Session Events Types (GET /api/sessions/:id/events)
// =====================================================

import type {
  SDKMessage,
  SDKUserMessage,
  SDKAuthStatusMessage,
} from '@anthropic-ai/claude-agent-sdk';

// SDK Message 型を re-export
export type { SDKMessage, SDKUserMessage, SDKAuthStatusMessage };

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
  data: SDKMessage[];
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

/**
 * @deprecated Use UserMessageContentBlock from message.ts instead
 */
export interface LegacyUserMessageContentBlock {
  type: 'text';
  text: string;
}

/**
 * @deprecated Use message types from message.ts instead
 */
export interface UserMessage {
  role: 'user';
  content: LegacyUserMessageContentBlock[];
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
  session: SessionResponse;
}
