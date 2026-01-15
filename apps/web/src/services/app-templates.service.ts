import { apiClient } from './api-client';
import type { AppTemplateCloneRequest, AppTemplateCloneResponse } from '@repo/types';

export const appTemplatesService = {
  /**
   * Clone a template to Databricks workspace
   */
  async cloneTemplate(request: AppTemplateCloneRequest): Promise<AppTemplateCloneResponse> {
    return apiClient<AppTemplateCloneResponse>('/api/databricks/app-templates/clone', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};
