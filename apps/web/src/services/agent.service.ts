import type {
  AgentListResponse,
  AgentDetailResponse,
  AgentCreateRequest,
  AgentCreateResponse,
  AgentImportRequest,
  AgentImportResponse,
  AgentUpdateRequest,
  AgentUpdateResponse,
  AgentDeleteResponse,
  AgentBackupResponse,
  AgentRestoreResponse,
} from '@repo/types';
import { apiClient } from './api-client';

export const agentService = {
  /** エージェント一覧取得 */
  getAgents: () => apiClient<AgentListResponse>('/api/user/agents'),

  /** エージェント詳細取得 */
  getAgent: (name: string) =>
    apiClient<AgentDetailResponse>(`/api/user/agents/${encodeURIComponent(name)}`),

  /** エージェント登録 */
  createAgent: (data: AgentCreateRequest) =>
    apiClient<AgentCreateResponse>('/api/user/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Gitインポート */
  importFromGit: (data: AgentImportRequest) =>
    apiClient<AgentImportResponse>('/api/user/agents/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** エージェント更新 */
  updateAgent: (name: string, data: AgentUpdateRequest) =>
    apiClient<AgentUpdateResponse>(`/api/user/agents/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** エージェント削除 */
  deleteAgent: (name: string) =>
    apiClient<AgentDeleteResponse>(`/api/user/agents/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      body: JSON.stringify({}),
    }),

  /** Workspace にバックアップ */
  backup: () =>
    apiClient<AgentBackupResponse>('/api/user/agents/backup', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  /** Workspace からリストア */
  restore: () =>
    apiClient<AgentRestoreResponse>('/api/user/agents/restore', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
