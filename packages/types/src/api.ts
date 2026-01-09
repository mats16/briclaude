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
