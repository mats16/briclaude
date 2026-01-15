import type {
  SkillListResponse,
  SkillDetailResponse,
  SkillCreateRequest,
  SkillCreateResponse,
  SkillImportRequest,
  SkillImportResponse,
  SkillUpdateRequest,
  SkillUpdateResponse,
  SkillDeleteResponse,
} from '@repo/types';
import { apiClient } from './api-client';

export const skillService = {
  /** スキル一覧取得 */
  getSkills: () => apiClient<SkillListResponse>('/api/user/skills'),

  /** スキル詳細取得 */
  getSkill: (name: string) =>
    apiClient<SkillDetailResponse>(`/api/user/skills/${encodeURIComponent(name)}`),

  /** スキル登録 */
  createSkill: (data: SkillCreateRequest) =>
    apiClient<SkillCreateResponse>('/api/user/skills', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Gitインポート */
  importFromGit: (data: SkillImportRequest) =>
    apiClient<SkillImportResponse>('/api/user/skills/import', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** スキル更新 */
  updateSkill: (name: string, data: SkillUpdateRequest) =>
    apiClient<SkillUpdateResponse>(`/api/user/skills/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** スキル削除 */
  deleteSkill: (name: string) =>
    apiClient<SkillDeleteResponse>(`/api/user/skills/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      body: JSON.stringify({}),
    }),
};
