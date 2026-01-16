// apps/api/src/mcp/dbapps.ts
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { DatabricksApp, AppDeployment } from '@repo/types';
import { SessionId } from '../models/session.model.js';

/**
 * Databricks Apps 管理用 MCP サーバー
 *
 * このサーバーは Claude エージェントが Databricks Apps を直接操作するための
 * ツールを提供します。CLI コマンド経由ではなく、API 経由で操作します。
 *
 * ## 提供ツール
 *
 * | ツール名 | 説明 |
 * |---------|------|
 * | `mcp__dbapps__create` | セッションに紐づくアプリを作成 |
 * | `mcp__dbapps__deploy` | アプリをデプロイ（自動的に outcomes の URL を更新） |
 * | `mcp__dbapps__get` | アプリ情報を取得 |
 * | `mcp__dbapps__list_deployments` | アプリのデプロイ履歴を取得 |
 *
 * ## アプリ名
 *
 * アプリ名は `app-${sessionId.getSuffix()}` で自動生成されます。
 * これにより、セッションごとに一意のアプリ名が保証されます。
 *
 * ## 使用例
 *
 * ```typescript
 * import { createDbAppsMcpServer } from '../mcp/dbapps.js';
 *
 * const response = query({
 *   prompt,
 *   options: {
 *     mcpServers: {
 *       dbapps: createDbAppsMcpServer(
 *         sessionId,
 *         databricksHost,
 *         workspacePath,
 *         () => ctx.getAccessToken()
 *       ),
 *     },
 *     allowedTools: [
 *       'mcp__dbapps__create',
 *       'mcp__dbapps__deploy',
 *       'mcp__dbapps__get',
 *       'mcp__dbapps__list_deployments',
 *     ],
 *   },
 * });
 * ```
 */
export function createDbAppsMcpServer(
  sessionId: SessionId,
  databricksHost: string,
  workspacePath: string,
  getAccessToken: () => Promise<string | undefined>
) {
  // アプリ名を生成（app-{suffix} 形式）
  const appName = `app-${sessionId.getSuffix()}`;
  const baseUrl = `https://${databricksHost}`;

  /**
   * Databricks API を呼び出すヘルパー関数
   */
  async function callDatabricksApi<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Access token is not available');
    }

    const url = new URL(path, baseUrl);
    const response = await fetch(url.toString(), {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Databricks API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  return createSdkMcpServer({
    name: 'apps',
    version: '1.0.0',
    tools: [
      {
        name: 'create_app',
        description: `Create a new Databricks App for this session.

The app name is automatically generated as: **${appName}**

This operation typically takes about 2 minutes to complete. After creating, you should deploy the app using the deploy tool.

**Note**: You don't need to specify an app name - it's automatically derived from the session ID.`,
        inputSchema: {
          type: 'object' as const,
          properties: {
            description: {
              type: 'string',
              description: 'Optional description for the app',
            },
          },
          required: [],
        },
        handler: async (params: Record<string, unknown>) => {
          const { description } = params as { description?: string };

          const requestBody: Record<string, unknown> = {
            name: appName,
          };
          if (description) {
            requestBody.description = description;
          }

          const app = await callDatabricksApi<DatabricksApp>('POST', '/api/2.0/apps', requestBody);

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(app) }],
          };
        },
      },
      {
        name: 'deploy_app',
        description: `Deploy the Databricks App.

- App name: **${appName}**
- Source code path: **${workspacePath}**`,
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
        handler: async () => {
          const deployment = await callDatabricksApi<AppDeployment>(
            'POST',
            `/api/2.0/apps/${appName}/deployments`,
            { source_code_path: workspacePath }
          );

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(deployment) }],
          };
        },
      },
      {
        name: 'show_app',
        description: `Get information about the Databricks App.

The app name is: **${appName}**

Returns app details including status, URL, and deployment information.`,
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
        handler: async () => {
          const app = await callDatabricksApi<DatabricksApp>('GET', `/api/2.0/apps/${appName}`);

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(app) }],
          };
        },
      },
      {
        name: 'list_deployments',
        description: `List deployment history for the Databricks App.

The app name is: **${appName}**

Returns all deployments for the app, including their status and timestamps.`,
        inputSchema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
        handler: async () => {
          interface ListDeploymentsResponse {
            deployments?: AppDeployment[];
          }

          const response = await callDatabricksApi<ListDeploymentsResponse>(
            'GET',
            `/api/2.0/apps/${appName}/deployments`
          );

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(response) }],
          };
        },
      },
    ],
  });
}
