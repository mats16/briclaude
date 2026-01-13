import type { WorkspaceListResponse } from '@repo/types';
import { apiClient } from './api-client';

export const workspaceService = {
  /**
   * 指定パス配下のWorkspaceオブジェクト一覧を取得
   */
  async listWorkspace(path: string): Promise<WorkspaceListResponse> {
    const params = new URLSearchParams({ path });
    return apiClient<WorkspaceListResponse>(`/api/workspace/list?${params}`);
  },
};
