import { apiClient } from './api-client';
import type { SessionStartRequest, SessionStartResponse } from '@repo/types';

export const sessionService = {
  async startSession(request: SessionStartRequest): Promise<SessionStartResponse> {
    return apiClient<SessionStartResponse>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },
};
