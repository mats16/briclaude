/**
 * Databricks Repos API types
 * @see https://docs.databricks.com/api/workspace/repos
 */

// POST /api/2.0/repos - Create a repo
export interface ReposCreateRequest {
  /** Git repository URL (required) */
  url: string;
  /** Git provider: gitHub, gitHubEnterprise, bitbucketCloud, bitbucketServer, azureDevOpsServices, gitLab, gitLabEnterpriseEdition, awsCodeCommit */
  provider: string;
  /** Path in workspace where repo will be created */
  path?: string;
  /** Sparse checkout configuration */
  sparse_checkout?: {
    patterns: string[];
  };
}

export interface ReposCreateResponse {
  /** Repo ID */
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
  /** Sparse checkout configuration */
  sparse_checkout?: {
    patterns: string[];
  };
}
