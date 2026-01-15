import { apiClient } from './api-client';
import type {
  AppTemplatesResponse,
  AppTemplateCloneRequest,
  AppTemplateCloneResponse,
} from '@repo/types';

export const appTemplatesService = {
  /**
   * Fetch available app templates from GitHub
   */
  async getTemplates(): Promise<AppTemplatesResponse> {
    return apiClient<AppTemplatesResponse>('/api/databricks/app-templates');
  },

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
