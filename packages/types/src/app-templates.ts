/**
 * Databricks App Templates types
 */

/** GitHub repository content item (directory entry) */
export interface GitHubContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
}

/** App template information */
export interface AppTemplate {
  /** Template name (directory name) */
  name: string;
  /** GitHub URL */
  url: string;
  /** Description extracted from README or template name */
  description?: string;
}

/** Response for GET /api/databricks/app-templates */
export interface AppTemplatesResponse {
  templates: AppTemplate[];
}

/** Request for POST /api/databricks/app-templates/clone */
export interface AppTemplateCloneRequest {
  /** Template name to clone */
  templateName: string;
  /** Target user name for workspace path */
  userName?: string;
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
