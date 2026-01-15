import { apiClient } from './api-client';
import type { ReposCreateRequest, ReposCreateResponse } from '@repo/types';

export const reposService = {
  /**
   * Create a repo in Databricks workspace
   */
  async createRepo(request: ReposCreateRequest): Promise<ReposCreateResponse> {
    return apiClient<ReposCreateResponse>('/api/databricks/repos', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};
