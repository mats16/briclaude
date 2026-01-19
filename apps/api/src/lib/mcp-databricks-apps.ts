// apps/api/src/lib/mcp-databricks-apps.ts
import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { SessionId } from '../models/session.model.js';
import { DatabricksAppsClient } from './databricks-apps-client.js';

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
 *
 * const response = query({
 *   prompt,
 *   options: {
 *     mcpServers: {
 *       dbapps: createDbAppsMcpServer(
 *         sessionId,
 *         host,
 *         clientId,
 *         clientSecret
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
  host: string,
  clientId: string,
  clientSecret: string,
  userName: string
) {
  // アプリ名を生成（app-{suffix} 形式）
  const appName = `app-${sessionId.getSuffix()}`;

  // クライアントを作成
  const client = new DatabricksAppsClient(host, clientId, clientSecret);

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
          const app = await client.create(appName, description);

          // ユーザーに CAN_MANAGE 権限を付与
          await client.updatePermissions(appName, [
            { user_name: userName, permission_level: 'CAN_MANAGE' },
          ]);

          return {
            content: [{ type: 'text' as const, text: JSON.stringify(app) }],
          };
        },
      },
      {
        name: 'deploy_app',
        description: `Deploy the Databricks App.

- App name: **${appName}**

You must specify the source code path in the Databricks Workspace where the app code is located.`,
        inputSchema: {
          type: 'object' as const,
          properties: {
            source_code_path: {
              type: 'string',
              description:
                'The Databricks Workspace path where the app source code is located (e.g., /Workspace/Users/user@example.com/my-app)',
            },
          },
          required: ['source_code_path'],
        },
        handler: async (params: Record<string, unknown>) => {
          const { source_code_path } = params as { source_code_path: string };
          const deployment = await client.deploy(appName, source_code_path);
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
          const app = await client.get(appName);
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
          const response = await client.listDeployments(appName);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(response) }],
          };
        },
      },
      {
        name: 'list_logs',
        description: `Get runtime logs for the Databricks App.

The app name is: **${appName}**

Returns stdout/stderr logs from the running app. Note: Logs are not persisted when app compute shuts down.

Options:
- tail_lines: Number of lines to retrieve from the end (default: 100)
- search: Filter logs by pattern
- source: Filter by log source (APP or SYSTEM)`,
        inputSchema: {
          type: 'object' as const,
          properties: {
            tail_lines: {
              type: 'number',
              description: 'Number of lines to retrieve from the end (default: 100)',
            },
            search: {
              type: 'string',
              description: 'Filter logs by pattern',
            },
            source: {
              type: 'string',
              enum: ['APP', 'SYSTEM'],
              description: 'Filter by log source: APP (application logs) or SYSTEM (system logs)',
            },
          },
          required: [],
        },
        handler: async (params: Record<string, unknown>) => {
          const { tail_lines, search, source } = params as {
            tail_lines?: number;
            search?: string;
            source?: 'APP' | 'SYSTEM';
          };
          const logs = await client.getLogs(appName, {
            tailLines: tail_lines,
            search,
            source,
          });
          return {
            content: [{ type: 'text' as const, text: logs }],
          };
        },
      },
      {
        name: 'update_permissions',
        description: `Update permissions for the Databricks App.

The app name is: **${appName}**

Use this to grant access to users or groups. Common use case: granting CAN_USE to the "users" group.

Permission levels:
- CAN_USE: Can view and run the app
- CAN_MANAGE: Can view, run, and manage the app`,
        inputSchema: {
          type: 'object' as const,
          properties: {
            user_name: {
              type: 'string',
              description: 'User name to grant permission (mutually exclusive with group_name)',
            },
            group_name: {
              type: 'string',
              description: 'Group name to grant permission (e.g., "users"). Mutually exclusive with user_name',
            },
            permission_level: {
              type: 'string',
              enum: ['CAN_USE', 'CAN_MANAGE'],
              description: 'Permission level to grant',
            },
          },
          required: ['permission_level'],
        },
        handler: async (params: Record<string, unknown>) => {
          const userName = params.user_name as string | undefined;
          const groupName = params.group_name as string | undefined;
          const permissionLevel = params.permission_level as 'CAN_USE' | 'CAN_MANAGE';

          if (!userName && !groupName) {
            throw new Error(
              `Either user_name or group_name must be specified. Received params: ${JSON.stringify(params)}`
            );
          }
          if (userName && groupName) {
            throw new Error('Only one of user_name or group_name can be specified');
          }

          const accessControlItem = userName
            ? { user_name: userName, permission_level: permissionLevel }
            : { group_name: groupName, permission_level: permissionLevel };

          const result = await client.updatePermissions(appName, [accessControlItem]);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          };
        },
      },
    ],
  });
}
