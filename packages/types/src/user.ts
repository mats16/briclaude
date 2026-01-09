// =====================================================
// User Types
// =====================================================

export interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export interface UserResponse {
  user: UserInfo;
}
