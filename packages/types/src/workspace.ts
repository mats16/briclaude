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
  object_id: number;
  language?: 'SCALA' | 'PYTHON' | 'SQL' | 'R';
  created_at?: number;
  modified_at?: number;
  size?: number;
}

/** GET /api/databricks/workspace/list query parameters */
export interface WorkspaceListQuerystring {
  path: string;
}

/** GET /api/databricks/workspace/list response */
export interface WorkspaceListResponse {
  objects?: WorkspaceObjectInfo[];
}

/** GET /api/databricks/workspace/get-status query parameters */
export interface WorkspaceGetStatusQuerystring {
  path: string;
}

/** GET /api/databricks/workspace/get-status response */
export type WorkspaceGetStatusResponse = WorkspaceObjectInfo;

/** POST /api/databricks/workspace/mkdirs request body */
export interface WorkspaceMkdirsRequest {
  path: string;
}

/** POST /api/databricks/workspace/mkdirs response - Empty object on success */
export type WorkspaceMkdirsResponse = Record<string, never>;

// =====================================================
// Workspace Selection Types (Frontend)
// =====================================================

/** 最近使用したWorkspaceパスの情報 */
export interface RecentWorkspace {
  path: string;
  name: string;
  last_used_at: number;
  object_type: WorkspaceObjectType;
  object_id: number;
}

/** Workspace選択時の結果 */
export interface WorkspaceSelection {
  path: string;
  name: string;
  object_type: WorkspaceObjectType;
  object_id: number;
}
