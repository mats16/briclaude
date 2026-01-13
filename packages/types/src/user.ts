// =====================================================
// User Types
// =====================================================

import type { TokenInfo } from './token.js';

export interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export interface UserResponse {
  user: UserInfo;
  databricksHost: string;
  tokens: TokenInfo[];
}
