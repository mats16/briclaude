/**
 * Databricks App Templates types
 */

/** Request for POST /api/databricks/app-templates/clone */
export interface AppTemplateCloneRequest {
  /** Template name to clone */
  templateName: string;
}

/** Response for POST /api/databricks/app-templates/clone */
export interface AppTemplateCloneResponse {
  /** Cloned repository ID */
  id: number;
  /** Path in workspace */
  path: string;
  /** Git repository URL */
  url: string;
  /** Git provider */
  provider: string;
  /** Current branch */
  branch: string;
  /** HEAD commit ID */
  head_commit_id: string;
}
