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
  databricks_host: string;
  tokens: TokenInfo[];
}
