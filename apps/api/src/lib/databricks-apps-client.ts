/**
 * Databricks Apps API クライアント
 *
 * Databricks Apps の作成、デプロイ、削除などの操作を行うクライアントです。
 * Service Principal を使用して認証します。
 */

import type { DatabricksApp, AppDeployment } from '@repo/types';
import { getServicePrincipalToken } from '../utils/databricks-auth.js';
import { normalizeHost } from '../utils/normalize-host.js';

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

/**
 * Databricks Apps API クライアント
 *
 * @example
 * ```typescript
 * const client = new DatabricksAppsClient(
 *   'my-workspace.databricks.com',
 *   'client-id',
 *   'client-secret'
 * );
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

  constructor(
    host: string,
    private readonly clientId: string,
    private readonly clientSecret: string
  ) {
    this.host = `https://${normalizeHost(host)}`;
  }

  /**
   * Service Principal トークンを取得
   */
  private getToken(): Promise<string | undefined> {
    return getServicePrincipalToken(this.host, this.clientId, this.clientSecret);
  }

  /**
   * Databricks API を呼び出すヘルパー関数
   */
  private async callApi<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Access token is not available');
    }

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

    // DELETE の場合は空レスポンスの可能性があるので、テキストを確認
    if (method === 'DELETE') {
      const text = await response.text();
      return (text ? JSON.parse(text) : {}) as T;
    }

    return response.json() as Promise<T>;
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
    await this.callApi<Record<string, never>>('DELETE', `/api/2.0/apps/${appName}`);
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

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // コマンド引数を構築
    const args = ['apps', 'logs', appName, '--tail-lines', String(tailLines)];
    if (search) {
      args.push('--search', search);
    }
    if (source) {
      args.push('--source', source);
    }

    const { stdout, stderr } = await execAsync(`databricks ${args.join(' ')}`, {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        DATABRICKS_HOST: this.host,
        DATABRICKS_CLIENT_ID: this.clientId,
        DATABRICKS_CLIENT_SECRET: this.clientSecret,
        DATABRICKS_AUTH_TYPE: 'oauth-m2m',
      },
    });

    return stdout || stderr;
  }
}
