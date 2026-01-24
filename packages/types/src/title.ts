// =====================================================
// Title Generation Types
// =====================================================

export interface GenerateTitleRequest {
  first_session_message: string;
  include_app_name?: boolean;
}

export interface GenerateTitleResponse {
  title: string;
  app_name?: string;
}
