export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

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
// User Types
// =====================================================

export interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export interface UserResponse {
  user: UserInfo;
}
