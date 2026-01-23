// =====================================================
// Skill Types
// =====================================================

/**
 * スキルメタデータ
 */
export interface SkillMetadata {
  /** バージョン */
  version?: string;
  /** 作者（GitHub org/user） */
  author?: string;
  /** ソースURL（リポジトリURL） */
  source?: string;
}

/**
 * スキル情報（一覧表示用）
 */
export interface SkillInfo {
  name: string;
  version: string;
  description: string;
  /** ファイルパス（相対パス） */
  file_path: string;
  /** メタデータ */
  metadata?: SkillMetadata;
  created_at: string;
  updated_at: string;
}

/**
 * スキル詳細情報（内容含む）
 */
export interface SkillDetail extends SkillInfo {
  content: string;
  /** ファイル全体の生データ（frontmatter + content） */
  raw_content: string;
}

// =====================================================
// Request / Response Types
// =====================================================

/**
 * スキル一覧取得レスポンス
 * GET /api/user/skills
 */
export interface SkillListResponse {
  skills: SkillInfo[];
}

/**
 * スキル詳細取得レスポンス
 * GET /api/user/skills/:name
 */
export interface SkillDetailResponse {
  skill: SkillDetail;
}

/**
 * スキル登録リクエスト
 * POST /api/user/skills
 */
export interface SkillCreateRequest {
  name: string;
  version: string;
  description: string;
  content: string;
}

/**
 * スキル登録レスポンス
 * POST /api/user/skills
 */
export interface SkillCreateResponse {
  success: boolean;
  message: string;
  skill: SkillInfo;
}

/**
 * Gitインポートリクエスト
 * POST /api/user/skills/import
 */
export interface SkillImportRequest {
  /** GitリポジトリURL（HTTPSまたはSSH） */
  repository_url: string;
  /** インポートするパス（リポジトリルートからの相対パス）- 複数指定可能 */
  paths: string[];
  /** ブランチ名（デフォルト: main） */
  branch?: string;
}

/**
 * Gitインポートレスポンス
 * POST /api/user/skills/import
 */
export interface SkillImportResponse {
  success: boolean;
  message: string;
  imported_skills: SkillInfo[];
}

/**
 * スキル更新リクエスト
 * PUT /api/user/skills/:name
 */
export interface SkillUpdateRequest {
  /** ファイル全体の生データ（frontmatter + content） */
  raw_content: string;
}

/**
 * スキル更新レスポンス
 * PUT /api/user/skills/:name
 */
export interface SkillUpdateResponse {
  success: boolean;
  message: string;
  skill: SkillInfo;
}

/**
 * スキル削除レスポンス
 * DELETE /api/user/skills/:name
 */
export interface SkillDeleteResponse {
  success: boolean;
  message: string;
}

/**
 * スキルバックアップレスポンス
 * POST /api/user/skills/backup
 */
export interface SkillBackupResponse {
  success: boolean;
  message: string;
  /** バックアップ先Workspaceパス */
  workspace_path: string;
}

/**
 * スキルリストアレスポンス
 * POST /api/user/skills/restore
 */
export interface SkillRestoreResponse {
  success: boolean;
  message: string;
}
