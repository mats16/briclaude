import { apiClient } from './api-client';
import type {
  SessionCreateRequest,
  SessionCreateResponse,
  SessionEventsResponse,
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

  async getSessionEvents(
    sessionId: string,
    options?: { after?: string; limit?: number }
  ): Promise<SessionEventsResponse> {
    const params = new URLSearchParams();
    if (options?.after !== undefined) {
      params.set('after', String(options.after));
    }
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    const queryString = params.toString();
    const url = `/api/sessions/${sessionId}/events${queryString ? `?${queryString}` : ''}`;
    return apiClient<SessionEventsResponse>(url);
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
