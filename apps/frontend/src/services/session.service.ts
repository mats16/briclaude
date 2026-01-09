import { apiClient } from './api-client';
import type { SessionCreateRequest, SessionCreateResponse } from '@repo/types';

export const sessionService = {
  async createSession(request: SessionCreateRequest): Promise<SessionCreateResponse> {
    return apiClient<SessionCreateResponse>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};
