// =====================================================
// Session Types
// =====================================================

export interface SessionSummary {
  id: string;
  title: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetail extends SessionSummary {
  sdkSessionId: string | null;
  databricksWorkspacePath: string | null;
  databricksWorkspaceAutoPush: boolean;
}

export interface SessionListResponse {
  sessions: SessionSummary[];
  total: number;
}

export interface CreateSessionRequest {
  title?: string;
}

export interface CreateSessionResponse {
  session: SessionDetail;
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
// Session Start Types (claude-agent-sdk連携用)
// =====================================================

export interface UserMessageContentBlock {
  type: 'text';
  text: string;
}

export interface UserMessage {
  role: 'user';
  content: UserMessageContentBlock[];
}

export interface SessionStartEvent {
  uuid: string;
  type: 'user';
  message: UserMessage;
}

export interface SessionContext {
  model: 'opus' | 'sonnet' | 'haiku';
  databricksWorkspacePath: string | null;
  databricksWorkspaceAutoPush: boolean;
}

export interface SessionStartRequest {
  events: SessionStartEvent[];
  session_context: SessionContext;
}

export interface SessionStartResponse {
  session_id: string;
}
