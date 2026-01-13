import type { UserResponse } from '@repo/types';
import { apiClient } from './api-client';

export const userService = {
  getCurrentUser: () => apiClient<UserResponse>('/api/user'),
};
