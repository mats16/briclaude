import { apiClient } from './api-client';
import type {
  SessionCreateRequest,
  SessionCreateResponse,
  GenerateTitleRequest,
  GenerateTitleResponse,
} from '@repo/types';

export const sessionService = {
  async createSession(request: SessionCreateRequest): Promise<SessionCreateResponse> {
    return apiClient<SessionCreateResponse>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async generateTitle(message: string): Promise<string | null> {
    try {
      const response = await apiClient<GenerateTitleResponse>('/api/generate_title', {
        method: 'POST',
        body: JSON.stringify({
          first_session_message: message,
        } satisfies GenerateTitleRequest),
      });
      return response.title;
    } catch {
      return null;
    }
  },
};
