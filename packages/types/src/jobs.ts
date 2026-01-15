/**
 * Databricks Jobs API types
 * @see https://docs.databricks.com/api/workspace/jobs
 */

// GET /api/2.2/jobs/list - List jobs
export interface JobsListQuerystring {
  /** Maximum number of jobs to return (default: 20, max: 100) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by job name (substring match) */
  name?: string;
  /** Whether to expand task details */
  expand_tasks?: boolean;
}

export interface JobSettings {
  name?: string;
  tags?: Record<string, string>;
  max_concurrent_runs?: number;
}

export interface Job {
  job_id: number;
  settings?: JobSettings;
  created_time?: number;
  creator_user_name?: string;
}

export interface JobsListResponse {
  jobs?: Job[];
  has_more?: boolean;
}

// GET /api/2.2/jobs/runs/list - List job runs
export interface JobRunsListQuerystring {
  /** Filter by job ID */
  job_id?: number;
  /** Maximum number of runs to return (default: 25, max: 25) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Only return active runs */
  active_only?: boolean;
  /** Only return completed runs */
  completed_only?: boolean;
  /** Filter by run type */
  run_type?: 'JOB_RUN' | 'WORKFLOW_RUN' | 'SUBMIT_RUN';
  /** Whether to expand task details */
  expand_tasks?: boolean;
  /** Filter runs started after this time (ms since epoch) */
  start_time_from?: number;
  /** Filter runs started before this time (ms since epoch) */
  start_time_to?: number;
}

export interface RunState {
  life_cycle_state?: string;
  result_state?: string;
  state_message?: string;
  user_cancelled_or_timedout?: boolean;
}

export interface JobRun {
  job_id: number;
  run_id: number;
  run_name?: string;
  state?: RunState;
  start_time?: number;
  end_time?: number;
  setup_duration?: number;
  execution_duration?: number;
  cleanup_duration?: number;
  trigger?: string;
  creator_user_name?: string;
  run_page_url?: string;
}

export interface JobRunsListResponse {
  runs?: JobRun[];
  has_more?: boolean;
}
