export interface RegisterTokenRequest {
  provider: 'databricks';
  auth_type: 'pat';
  token: string;
}

export interface RegisterTokenResponse {
  success: boolean;
  message: string;
}

export interface TokenInfo {
  provider: string;
  auth_type: string;
  masked_token: string;
  created_at: string;
  updated_at: string;
}

export interface TokenListResponse {
  tokens: TokenInfo[];
}

export interface DeleteTokenRequest {
  provider: 'databricks';
  auth_type: 'pat';
}

export interface DeleteTokenResponse {
  success: boolean;
  message: string;
}
