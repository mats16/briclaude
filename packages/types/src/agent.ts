// =====================================================
// Agent Types
// =====================================================

/**
 * エージェントメタデータ
 */
export interface AgentMetadata {
  /** バージョン */
  version?: string;
  /** 作者（GitHub org/user） */
  author?: string;
  /** ソースURL（リポジトリURL） */
  source?: string;
}

/**
 * エージェント情報（一覧表示用）
 */
export interface AgentInfo {
  name: string;
  version: string;
  description: string;
  /** 利用可能なツール一覧（カンマ区切り文字列） */
  tools?: string;
  /** ファイルパス（相対パス） */
  file_path: string;
  /** メタデータ */
  metadata?: AgentMetadata;
  created_at: string;
  updated_at: string;
}

/**
 * エージェント詳細情報（内容含む）
 */
export interface AgentDetail extends AgentInfo {
  content: string;
  /** ファイル全体の生データ（frontmatter + content） */
  raw_content: string;
}

// =====================================================
// Request / Response Types
// =====================================================

/**
 * エージェント一覧取得レスポンス
 * GET /api/user/agents
 */
export interface AgentListResponse {
  agents: AgentInfo[];
}

/**
 * エージェント詳細取得レスポンス
 * GET /api/user/agents/:name
 */
export interface AgentDetailResponse {
  agent: AgentDetail;
}

/**
 * エージェント登録リクエスト
 * POST /api/user/agents
 */
export interface AgentCreateRequest {
  name: string;
  version: string;
  description: string;
  content: string;
  tools?: string;
}

/**
 * エージェント登録レスポンス
 * POST /api/user/agents
 */
export interface AgentCreateResponse {
  success: boolean;
  message: string;
  agent: AgentInfo;
}

/**
 * Gitインポートリクエスト
 * POST /api/user/agents/import
 */
export interface AgentImportRequest {
  /** GitリポジトリURL（HTTPSまたはSSH） */
  repository_url: string;
  /** インポートするパス（リポジトリルートからの相対パス）- 複数指定可能 */
  paths: string[];
  /** ブランチ名（デフォルト: main） */
  branch?: string;
}

/**
 * Gitインポートレスポンス
 * POST /api/user/agents/import
 */
export interface AgentImportResponse {
  success: boolean;
  message: string;
  imported_agents: AgentInfo[];
}

/**
 * エージェント更新リクエスト
 * PUT /api/user/agents/:name
 */
export interface AgentUpdateRequest {
  /** ファイル全体の生データ（frontmatter + content） */
  raw_content: string;
}

/**
 * エージェント更新レスポンス
 * PUT /api/user/agents/:name
 */
export interface AgentUpdateResponse {
  success: boolean;
  message: string;
  agent: AgentInfo;
}

/**
 * エージェント削除レスポンス
 * DELETE /api/user/agents/:name
 */
export interface AgentDeleteResponse {
  success: boolean;
  message: string;
}

/**
 * エージェントバックアップレスポンス
 * POST /api/user/agents/backup
 */
export interface AgentBackupResponse {
  success: boolean;
  message: string;
  /** バックアップ先Workspaceパス */
  workspace_path: string;
}

/**
 * エージェントリストアレスポンス
 * POST /api/user/agents/restore
 */
export interface AgentRestoreResponse {
  success: boolean;
  message: string;
}
