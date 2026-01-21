/**
 * Databricks Apps API クライアント
 *
 * Databricks Apps の作成、デプロイ、削除などの操作を行うクライアントです。
 * AuthProvider を使用して認証します（PAT または Service Principal）。
 */

import type { DatabricksApp, AppDeployment } from '@repo/types';
import type { AuthProvider } from './databricks-auth.js';
import { execFile } from 'child_process';

export interface ListDeploymentsResponse {
  deployments?: AppDeployment[];
}

export interface GetLogsOptions {
  /** Number of lines to retrieve from the end (default: 100) */
  tailLines?: number;
  /** Filter logs by pattern */
  search?: string;
  /** Filter by log source: APP or SYSTEM */
  source?: 'APP' | 'SYSTEM';
}

/** Permission level for Databricks Apps */
export type AppPermissionLevel = 'CAN_USE' | 'CAN_MANAGE';

export interface AccessControlItem {
  /** User name (email) to grant permission */
  user_name?: string;
  /** Group name to grant permission */
  group_name?: string;
  /** Service principal name to grant permission */
  service_principal_name?: string;
  /** Permission level */
  permission_level: AppPermissionLevel;
}

export interface SetPermissionsRequest {
  access_control_list: AccessControlItem[];
}

export interface PermissionInfo {
  permission_level: AppPermissionLevel;
  inherited: boolean;
  inherited_from_object?: string[];
}

export interface AccessControlListItem {
  user_name?: string;
  group_name?: string;
  service_principal_name?: string;
  all_permissions: PermissionInfo[];
}

export interface ObjectPermissions {
  object_id?: string;
  object_type?: string;
  access_control_list: AccessControlListItem[];
}

/**
 * Databricks Apps API クライアント
 *
 * @example
 * ```typescript
 * import { getAuthProvider } from './databricks-auth.js';
 *
 * const authProvider = await getAuthProvider(fastify, userId);
 * const client = new DatabricksAppsClient(authProvider);
 *
 * // アプリ作成
 * const app = await client.create('my-app', 'My app description');
 *
 * // デプロイ
 * const deployment = await client.deploy('my-app', '/Workspace/Users/user@example.com/my-app');
 *
 * // 削除
 * await client.delete('my-app');
 * ```
 */
export class DatabricksAppsClient {
  /** Databricks ワークスペースホスト (e.g. https://dbc-123456789.cloud.databricks.com) */
  private readonly host: string;

  constructor(private readonly authProvider: AuthProvider) {
    this.host = authProvider.getEnvVars().DATABRICKS_HOST;
  }

  /**
   * アクセストークンを取得
   */
  private getToken(): Promise<string> {
    return this.authProvider.getToken();
  }

  /**
   * Databricks API を呼び出すヘルパー関数
   */
  private async callApi<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getToken();

    const url = new URL(path, this.host);
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Databricks API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Databricks API を呼び出す（レスポンスなし、DELETE 用）
   */
  private async callApiNoContent(path: string): Promise<void> {
    const token = await this.getToken();

    const url = new URL(path, this.host);
    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Databricks API error (${response.status}): ${errorText}`);
    }
  }

  /**
   * 新しい Databricks App を作成
   *
   * @param name - アプリ名
   * @param description - オプションの説明
   * @returns 作成されたアプリ情報
   */
  async create(name: string, description?: string): Promise<DatabricksApp> {
    const requestBody: Record<string, unknown> = { name };
    if (description) {
      requestBody.description = description;
    }
    return this.callApi<DatabricksApp>('POST', '/api/2.0/apps', requestBody);
  }

  /**
   * Databricks App をデプロイ
   *
   * @param appName - アプリ名
   * @param sourceCodePath - Databricks Workspace 上のソースコードパス
   * @returns デプロイ情報
   */
  async deploy(appName: string, sourceCodePath: string): Promise<AppDeployment> {
    return this.callApi<AppDeployment>('POST', `/api/2.0/apps/${appName}/deployments`, {
      source_code_path: sourceCodePath,
    });
  }

  /**
   * Databricks App の情報を取得
   *
   * @param appName - アプリ名
   * @returns アプリ情報
   */
  async get(appName: string): Promise<DatabricksApp> {
    return this.callApi<DatabricksApp>('GET', `/api/2.0/apps/${appName}`);
  }

  /**
   * Databricks App のデプロイ履歴を取得
   *
   * @param appName - アプリ名
   * @returns デプロイ履歴
   */
  async listDeployments(appName: string): Promise<ListDeploymentsResponse> {
    return this.callApi<ListDeploymentsResponse>('GET', `/api/2.0/apps/${appName}/deployments`);
  }

  /**
   * Databricks App を削除
   *
   * @param appName - アプリ名
   */
  async delete(appName: string): Promise<void> {
    await this.callApiNoContent(`/api/2.0/apps/${appName}`);
  }

  /**
   * Databricks App を開始
   *
   * @param appName - アプリ名
   * @returns アプリ情報
   */
  async start(appName: string): Promise<DatabricksApp> {
    return this.callApi<DatabricksApp>('POST', `/api/2.0/apps/${appName}/start`);
  }

  /**
   * Databricks App を停止
   *
   * @param appName - アプリ名
   * @returns アプリ情報
   */
  async stop(appName: string): Promise<DatabricksApp> {
    return this.callApi<DatabricksApp>('POST', `/api/2.0/apps/${appName}/stop`);
  }

  /**
   * Databricks App の権限を更新（既存の権限に追加/更新）
   *
   * @param appName - アプリ名
   * @param accessControlList - アクセス制御リスト
   * @returns 更新された権限情報
   */
  async updatePermissions(
    appName: string,
    accessControlList: AccessControlItem[]
  ): Promise<ObjectPermissions> {
    return this.callApi<ObjectPermissions>('PATCH', `/api/2.0/permissions/apps/${appName}`, {
      access_control_list: accessControlList,
    });
  }

  /**
   * Databricks App のランタイムログを取得
   *
   * Note: この機能は Databricks CLI を使用します。
   *
   * @param appName - アプリ名
   * @param options - ログ取得オプション
   * @returns ログ出力
   */
  async getLogs(appName: string, options: GetLogsOptions = {}): Promise<string> {
    const { tailLines = 100, search, source } = options;

    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    // コマンド引数を構築（execFile は引数を配列で受け取るためコマンドインジェクションを防止）
    const args = ['apps', 'logs', appName, '--tail-lines', String(tailLines)];
    if (search) {
      args.push('--search', search);
    }
    if (source) {
      args.push('--source', source);
    }

    // AuthProvider から環境変数を取得
    const envVars = this.authProvider.getEnvVars();

    const { stdout, stderr } = await execFileAsync('databricks', args, {
      env: {
        PATH: `${process.env.HOME}/bin:${process.env.PATH}`,
        HOME: process.env.HOME,
        ...envVars,
      },
      timeout: 30000,
    });

    return stdout.trim() || stderr.trim();
  }
}
