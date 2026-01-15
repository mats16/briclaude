import { apiClient } from './api-client';
import type { JobRunsListResponse, JobRunsListQuerystring } from '@repo/types';

export const jobsService = {
  /**
   * Get failed job runs
   * @param options Query options
   * @returns List of failed job runs
   */
  async getFailedJobRuns(
    options: Omit<JobRunsListQuerystring, 'completed_only'> = {}
  ): Promise<JobRunsListResponse> {
    const params = new URLSearchParams();

    // Always filter to completed runs only to get final state
    params.set('completed_only', 'true');

    if (options.job_id !== undefined) params.set('job_id', String(options.job_id));
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.offset !== undefined) params.set('offset', String(options.offset));
    if (options.run_type !== undefined) params.set('run_type', options.run_type);
    if (options.expand_tasks !== undefined) params.set('expand_tasks', String(options.expand_tasks));
    if (options.start_time_from !== undefined)
      params.set('start_time_from', String(options.start_time_from));
    if (options.start_time_to !== undefined)
      params.set('start_time_to', String(options.start_time_to));

    const response = await apiClient<JobRunsListResponse>(
      `/api/databricks/jobs/runs/list?${params.toString()}`
    );

    // Filter to only FAILED runs on client side
    // (Databricks API doesn't support filtering by result_state)
    return {
      ...response,
      runs: response.runs?.filter(run => run.state?.result_state === 'FAILED') ?? [],
    };
  },
};
