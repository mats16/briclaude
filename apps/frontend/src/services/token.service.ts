import type {
  RegisterTokenRequest,
  RegisterTokenResponse,
  TokenListResponse,
  DeleteTokenRequest,
  DeleteTokenResponse,
} from '@repo/types';
import { apiClient } from './api-client';

export const tokenService = {
  getTokens: () => apiClient<TokenListResponse>('/api/user/tokens'),

  registerToken: (data: RegisterTokenRequest) =>
    apiClient<RegisterTokenResponse>('/api/user/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteToken: (data: DeleteTokenRequest) =>
    apiClient<DeleteTokenResponse>('/api/user/tokens', {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),
};
