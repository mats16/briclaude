import type {
  WorkspaceListResponse,
  WorkspaceGetStatusResponse,
  WorkspaceMkdirsRequest,
  WorkspaceMkdirsResponse,
} from '@repo/types';
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

  /**
   * 指定パスにディレクトリを作成（親ディレクトリも自動作成）
   */
  async mkdirs(path: string): Promise<WorkspaceMkdirsResponse> {
    const request: WorkspaceMkdirsRequest = { path };
    return apiClient<WorkspaceMkdirsResponse>('/api/databricks/workspace/mkdirs', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};
