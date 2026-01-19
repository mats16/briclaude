import type { SessionOutcome } from './session.js';
import type { DatabricksApp, AppDeployment } from './apps.js';

// =====================================================
// MCP Tool Types for ctx server
// =====================================================

/**
 * mcp__ctx__get_outcomes のレスポンス
 */
export interface GetOutcomesResponse {
  outcomes: SessionOutcome[];
}

/**
 * mcp__ctx__update_outcome のリクエスト
 */
export interface UpdateOutcomeRequest {
  /** 更新対象の outcome のインデックス */
  index: number;
  /** 新しい outcome データ */
  outcome: SessionOutcome;
}

/**
 * mcp__ctx__update_outcome のレスポンス
 */
export interface UpdateOutcomeResponse {
  success: boolean;
  outcomes: SessionOutcome[];
}

// =====================================================
// MCP Tool Types for dbapps server
// =====================================================

/**
 * mcp__dbapps__create のリクエスト
 */
export interface DbAppsCreateRequest {
  /** アプリの説明（オプション） */
  description?: string;
}

/**
 * mcp__dbapps__create のレスポンス
 */
export interface DbAppsCreateResponse {
  success: boolean;
  app: DatabricksApp;
}

/**
 * mcp__dbapps__deploy のリクエスト
 */
export interface DbAppsDeployRequest {
  /** ソースコードの Workspace パス */
  source_code_path: string;
  /** デプロイモード */
  mode?: 'SNAPSHOT' | 'AUTO_SYNC';
}

/**
 * mcp__dbapps__deploy のレスポンス
 */
export interface DbAppsDeployResponse {
  success: boolean;
  deployment: AppDeployment;
  app_name: string;
  app_url: string;
}

/**
 * mcp__dbapps__get のレスポンス
 */
export interface DbAppsGetResponse {
  app: DatabricksApp;
}

/**
 * mcp__dbapps__list_deployments のレスポンス
 */
export interface DbAppsListDeploymentsResponse {
  deployments: AppDeployment[];
}

/**
 * mcp__dbapps__list_logs のリクエスト
 */
export interface DbAppsListLogsRequest {
  /** 末尾から取得する行数（デフォルト: 100） */
  tail_lines?: number;
  /** ログをフィルタリングするパターン */
  search?: string;
  /** ログソースでフィルタリング: APP（アプリケーションログ）または SYSTEM（システムログ） */
  source?: 'APP' | 'SYSTEM';
}

/**
 * mcp__dbapps__list_logs のレスポンス
 */
export interface DbAppsListLogsResponse {
  logs: string;
}
