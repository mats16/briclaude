import type { WorkspaceListResponse, WorkspaceGetStatusResponse } from '@repo/types';
import { apiClient } from './api-client';

export const workspaceService = {
  /**
   * 指定パス配下のWorkspaceオブジェクト一覧を取得
   */
  async listWorkspace(path: string): Promise<WorkspaceListResponse> {
    const params = new URLSearchParams({ path });
    return apiClient<WorkspaceListResponse>(`/api/databricks/workspace/list?${params}`);
  },

  /**
   * 指定パスのWorkspaceオブジェクト情報を取得
   */
  async getStatus(path: string): Promise<WorkspaceGetStatusResponse> {
    const params = new URLSearchParams({ path });
    return apiClient<WorkspaceGetStatusResponse>(`/api/databricks/workspace/get-status?${params}`);
  },
};
