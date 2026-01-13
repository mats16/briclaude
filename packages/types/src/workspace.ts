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
