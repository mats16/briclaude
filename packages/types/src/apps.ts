// =====================================================
// Databricks Apps API Types
// @see https://docs.databricks.com/api/workspace/apps/get
// =====================================================

/**
 * App Deployment Status
 */
export interface AppDeploymentStatus {
  state?: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'STOPPED';
  message?: string;
}

/**
 * App Deployment
 */
export interface AppDeployment {
  deployment_id?: string;
  source_code_path?: string;
  mode?: 'SNAPSHOT' | 'AUTO_SYNC';
  status?: AppDeploymentStatus;
  create_time?: string;
  update_time?: string;
}

/**
 * App Compute Status
 */
export interface AppComputeStatus {
  state?: 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'ERROR';
  message?: string;
}

/**
 * App Status
 */
export interface AppStatus {
  state?: 'RUNNING' | 'DEPLOYING' | 'CRASHED' | 'UNAVAILABLE' | string;
  message?: string;
}

/**
 * Databricks App
 */
export interface DatabricksApp {
  name: string;
  description?: string;
  id?: string;
  creator?: string;
  create_time?: string;
  update_time?: string;
  url?: string;
  active_deployment?: AppDeployment;
  pending_deployment?: AppDeployment;
  compute_status?: AppComputeStatus;
  app_status?: AppStatus;
  default_source_code_path?: string;
  effective_api_scopes?: string[];
}

// =====================================================
// Session App API Types
// =====================================================

/**
 * GET /api/sessions/:session_id/app のレスポンス型
 */
export type SessionAppResponse = DatabricksApp;
