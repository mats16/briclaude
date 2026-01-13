/**
 * Databricks Workspace API types
 * @see https://docs.databricks.com/api/workspace/workspace/list
 */

/** Type of workspace object */
export type WorkspaceObjectType =
  | 'NOTEBOOK'
  | 'DIRECTORY'
  | 'LIBRARY'
  | 'FILE'
  | 'REPO'
  | 'MLFLOW_EXPERIMENT'
  | 'DASHBOARD';

/** Workspace object information */
export interface WorkspaceObjectInfo {
  path: string;
  object_type: WorkspaceObjectType;
  object_id?: number;
  language?: 'SCALA' | 'PYTHON' | 'SQL' | 'R';
  created_at?: number;
  modified_at?: number;
  size?: number;
}

/** GET /api/workspace/list query parameters */
export interface WorkspaceListQuerystring {
  path: string;
}

/** GET /api/workspace/list response */
export interface WorkspaceListResponse {
  objects?: WorkspaceObjectInfo[];
}

/** GET /api/workspace/get-status query parameters */
export interface WorkspaceGetStatusQuerystring {
  path: string;
}

/** GET /api/workspace/get-status response */
export interface WorkspaceGetStatusResponse extends WorkspaceObjectInfo {}

/** POST /api/workspace/mkdirs request body */
export interface WorkspaceMkdirsRequest {
  path: string;
}

/** POST /api/workspace/mkdirs response */
export interface WorkspaceMkdirsResponse {
  // Empty object on success
}

// =====================================================
// Workspace Selection Types (Frontend)
// =====================================================

/** 最近使用したWorkspaceパスの情報 */
export interface RecentWorkspace {
  path: string;
  name: string;
  last_used_at: number;
}

/** Workspace選択時の結果 */
export interface WorkspaceSelection {
  path: string;
  name: string;
  object_type: WorkspaceObjectType;
}
