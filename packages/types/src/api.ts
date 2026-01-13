// =====================================================
// Common API Types
// =====================================================

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

// =====================================================
// Session Error Codes
// =====================================================

/**
 * セッション操作時のエラーコード
 */
export type SessionErrorCode =
  /** アクセストークン（PAT/SP）が取得できない */
  | 'NO_ACCESS_TOKEN'
  /** アクセストークン取得中にネットワーク/DBエラーが発生 */
  | 'TOKEN_RETRIEVAL_ERROR';

/**
 * コード付きエラー型
 */
export interface CodedError extends Error {
  code: SessionErrorCode;
}

/**
 * エラーコードが認証関連かどうかを判定
 */
export function isAuthError(code: string | undefined): code is SessionErrorCode {
  return code === 'NO_ACCESS_TOKEN' || code === 'TOKEN_RETRIEVAL_ERROR';
}
