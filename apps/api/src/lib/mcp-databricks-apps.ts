// apps/api/src/lib/mcp-databricks-apps.ts
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { SessionId } from '../models/session.model.js';
import { DatabricksAppsClient } from './databricks-apps-client.js';
import type { AuthProvider } from './databricks-auth.js';

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
 * | `mcp__dbapps__create_app` | セッションに紐づくアプリを作成 |
 * | `mcp__dbapps__deploy_app` | アプリをデプロイ（自動的に outcomes の URL を更新） |
 * | `mcp__dbapps__show_app` | アプリ情報を取得 |
 * | `mcp__dbapps__list_deployments` | アプリのデプロイ履歴を取得 |
 * | `mcp__dbapps__list_logs` | アプリのランタイムログを取得 |
 *
 * ## アプリ名
 *
 * アプリ名は `app-${sessionId.getSuffix()}` で自動生成されます。
 * これにより、セッションごとに一意のアプリ名が保証されます。
 *
 * ## 使用例
 *
 * ```typescript
 * import { createDbAppsMcpServer } from '../lib/mcp-databricks-apps.js';
 * import { getAuthProvider } from '../lib/databricks-auth.js';
 *
 * const authProvider = await getAuthProvider(fastify, userId);
 *
 * const response = query({
 *   prompt,
 *   options: {
 *     mcpServers: {
 *       dbapps: createDbAppsMcpServer(authProvider, sessionId, userName),
 *     },
 *     allowedTools: [
 *       'mcp__dbapps__create_app',
 *       'mcp__dbapps__deploy_app',
 *       'mcp__dbapps__show_app',
 *       'mcp__dbapps__list_deployments',
 *       'mcp__dbapps__list_logs',
 *     ],
 *   },
 * });
 * ```
 */
export function createDbAppsMcpServer(
  authProvider: AuthProvider,
  sessionId: SessionId,
  userName: string
) {
  // アプリ名を生成（app-{suffix} 形式）
  const appName = `app-${sessionId.getSuffix()}`;

  // クライアントを作成
  const client = new DatabricksAppsClient(authProvider);

  const createApp = tool(
    'create_app',
    `Create a new Databricks App for this session.

The app name is automatically generated as: **${appName}**

This operation typically takes about 3 minutes to complete. After creating, you should deploy the app using the deploy tool.

**Note**: You don't need to specify an app name - it's automatically derived from the session ID.`,
    {
      description: z.string().optional().describe('Optional description for the app'),
    },
    async ({ description }) => {
      const app = await client.create(appName, description);

      if (authProvider.type === 'oauth-m2m') {
        // ユーザーに CAN_MANAGE 権限を付与
        await client.updatePermissions(appName, [
          { user_name: userName, permission_level: 'CAN_MANAGE' },
        ]);
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(app) }],
        structuredContent: app,
      };
    }
  );

  const deployApp = tool(
    'deploy_app',
    `Deploy the Databricks App.

- App name: **${appName}**

You must specify the source code path in the Databricks Workspace where the app code is located.`,
    {
      source_code_path: z
        .string()
        .startsWith('/Workspace/')
        .describe(
          'The Databricks Workspace path where the app source code is located (e.g., /Workspace/Users/user@example.com/my-app)'
        ),
    },
    async ({ source_code_path }) => {
      const deployment = await client.deploy(appName, source_code_path);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(deployment) }],
        structuredContent: deployment,
      };
    }
  );

  const showApp = tool(
    'show_app',
    `Get information about the Databricks App.

The app name is: **${appName}**

Returns app details including status, URL, and deployment information.`,
    {},
    async () => {
      const app = await client.get(appName);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(app) }],
        structuredContent: app,
      };
    }
  );

  const listDeployments = tool(
    'list_deployments',
    `List deployment history for the Databricks App.

The app name is: **${appName}**

Returns all deployments for the app, including their status and timestamps.`,
    {},
    async () => {
      const response = await client.listDeployments(appName);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(response) }],
        structuredContent: response,
      };
    }
  );

  const listLogs = tool(
    'list_logs',
    `Get runtime logs for the Databricks App.

The app name is: **${appName}**

Returns stdout/stderr logs from the running app. Note: Logs are not persisted when app compute shuts down.`,
    {
      tail_lines: z
        .number()
        .optional()
        .describe('Number of lines to retrieve from the end (default: 100)'),
      search: z.string().optional().describe('Filter logs by pattern'),
      source: z
        .enum(['APP', 'SYSTEM'])
        .optional()
        .describe('Filter by log source: APP (application logs) or SYSTEM (system logs)'),
    },
    async ({ tail_lines, search, source }) => {
      const logs = await client.getLogs(appName, {
        tailLines: tail_lines,
        search,
        source,
      });
      return {
        content: [{ type: 'text' as const, text: logs }],
        structuredContent: { logs: logs.split('\n') },
      };
    }
  );

  return createSdkMcpServer({
    name: 'apps',
    version: '1.0.0',
    tools: [createApp, deployApp, showApp, listDeployments, listLogs],
  });
}
