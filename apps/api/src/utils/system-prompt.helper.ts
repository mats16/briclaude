import type { DatabricksWorkspaceSource, DatabricksAppsOutcome, SessionOutcome } from '@repo/types';

/** systemPrompt の設定型 */
export interface SystemPromptConfig {
  type: 'preset';
  preset: 'claude_code';
  append?: string;
}

/**
 * outcomes に基づいて systemPrompt 設定を構築
 *
 * @param outcomes - セッションの outcomes 配列
 * @returns systemPrompt の設定オブジェクト
 *
 * @example
 * ```typescript
 * const config = buildSystemPromptConfig(session_context.outcomes);
 * // Use in query() options: systemPrompt: config
 * ```
 */
export function buildSystemPromptConfig(outcomes: SessionOutcome[] = []): SystemPromptConfig {
  // outcomes から必要な値を抽出
  const workspaceOutcome = outcomes.find(
    (o): o is DatabricksWorkspaceSource => o.type === 'databricks_workspace'
  );
  const appsOutcome = outcomes.find(
    (o): o is DatabricksAppsOutcome => o.type === 'databricks_apps' && !!o.name
  );

  const workspacePath = workspaceOutcome?.path;
  const appName = appsOutcome?.name;

  // Apps outcome がある場合は Apps instruction のみ（Workspace Push を含む）
  // そうでなければ Workspace instruction のみ
  // 注: Apps のみのパターンは存在しない（Apps がある場合は必ず Workspace もある）
  let append: string | undefined;

  if (appName && workspacePath) {
    append = createDatabricksAppsInstruction(workspacePath, appName);
  } else if (workspacePath) {
    append = createWorkspacePushInstruction(workspacePath);
  }

  if (append) {
    return { type: 'preset', preset: 'claude_code', append };
  }
  return { type: 'preset', preset: 'claude_code' };
}

/**
 * Databricks Workspace にファイルをアップロードするための systemPrompt 追加指示を生成
 *
 * @param workspacePath - push 先の Databricks Workspace パス
 * @returns systemPrompt に追加する指示文字列
 *
 * @example
 * ```typescript
 * const instruction = createWorkspacePushInstruction('/Workspace/Users/user@example.com/project');
 * // Returns markdown instruction text for Claude
 * ```
 */
export function createWorkspacePushInstruction(workspacePath: string): string {
  return `
Your task is to complete the request described in the task description.

Instructions:
1. For questions: Research the codebase and provide a detailed answer
2. For implementations: Make the requested changes and push to Databricks Workspace

## Databricks Workspace Push Requirements

The workspace path is provided via the \`DATABRICKS_WORKSPACE_PATH\` environment variable: \`${workspacePath}\`

### Important Instructions:

1. **DEVELOP** all your changes in the current working directory
2. **PUSH** your completed work to the specified Workspace path
3. **NEVER** push to a different workspace path without explicit permission

### CLI Reference:

- To push all files from the session directory to workspace:
  \`databricks sync --exclude .claude/settings.local.json . "$DATABRICKS_WORKSPACE_PATH"\`
- To check the upload result:
  \`databricks workspace list "$DATABRICKS_WORKSPACE_PATH"\`
`.trim();
}

/**
 * Databricks Apps をデプロイするための systemPrompt 追加指示を生成
 *
 * @param workspacePath - Workspace のパス
 * @param appName - デプロイする App の名前
 * @returns systemPrompt に追加する指示文字列
 *
 * @example
 * ```typescript
 * const instruction = createDatabricksAppsInstruction('/Workspace/Users/user@example.com/project', 'app-01h455vb4pex5vsknk084sn02q');
 * // Returns markdown instruction text for Claude
 * ```
 */
export function createDatabricksAppsInstruction(workspacePath: string, appName: string): string {
  return `
Your task is to complete the request described in the task description.

Instructions:
1. For questions: Research the codebase and provide a detailed answer
2. For implementations: Make the requested changes, push to Workspace and **deploy Databricks Apps**

## Databricks Apps Development Requirements

- Workspace path: \`DATABRICKS_WORKSPACE_PATH\` = \`${workspacePath}\`
- App name: \`DATABRICKS_APP_NAME\` = \`${appName}\`

The app name is derived from the session ID and has a 1:1 mapping with the user's session.
Do not modify this name—changing it will break the association between the deployed app and its session.

### Important Instructions:

**Use TodoWrite to create tasks for each step below.** Mark each task complete as you finish it.
Do not consider the work done until the app is successfully deployed and verified.

1. **CREATE** the app (takes ~2 minutes)
2. **DEVELOP** all your changes in the current working directory
3. **PUSH** your completed work to the specified Workspace path (NOT sufficient, need to DEPLOY the app)
4. **DEPLOY** the app from the specified Workspace path
5. **VERIFY** deployment status

### CLI Reference:

- To create the app:
  \`databricks apps create "$DATABRICKS_APP_NAME" --no-wait\`
- To deploy the app:
  \`databricks apps deploy "$DATABRICKS_APP_NAME" --source-code-path "$DATABRICKS_WORKSPACE_PATH"\`
- To get the app details and status:
  \`databricks apps get "$DATABRICKS_APP_NAME"\`
- To push all files from the session directory to workspace:
  \`databricks sync --exclude .claude/settings.local.json . "$DATABRICKS_WORKSPACE_PATH"\`
- To check the upload result:
  \`databricks workspace list "$DATABRICKS_WORKSPACE_PATH"\`

If any step fails, troubleshoot and retry. Do NOT consider the task complete until the app is accessible.
`.trim();
}
