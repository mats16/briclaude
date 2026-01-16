import type { DatabricksWorkspaceSource, DatabricksAppsOutcome, SessionOutcome } from '@repo/types';

/** systemPrompt の設定型 */
export interface SystemPromptConfig {
  type: 'preset';
  preset: 'claude_code';
  append?: string;
}

/**
 * outcomes から Databricks Workspace のエントリを抽出
 */
function filterWorkspaceOutcomes(outcomes: SessionOutcome[]): DatabricksWorkspaceSource[] {
  return outcomes.filter((o): o is DatabricksWorkspaceSource => o.type === 'databricks_workspace');
}

/**
 * outcomes から Databricks Apps のエントリを抽出
 */
function filterAppsOutcomes(outcomes: SessionOutcome[]): DatabricksAppsOutcome[] {
  return outcomes.filter((o): o is DatabricksAppsOutcome => o.type === 'databricks_apps');
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
  const workspaceOutcomes = filterWorkspaceOutcomes(outcomes);
  const appsOutcomes = filterAppsOutcomes(outcomes);

  const workspaceInstruction = createWorkspacePushInstruction(workspaceOutcomes);
  const appsInstruction = createDatabricksAppsInstruction(appsOutcomes);

  // instruction を結合（存在する場合のみ）
  const instructions = [workspaceInstruction, appsInstruction].filter(Boolean);
  const append = instructions.length > 0 ? instructions.join('\n\n') : undefined;

  if (append) {
    return { type: 'preset', preset: 'claude_code', append };
  }
  return { type: 'preset', preset: 'claude_code' };
}

/**
 * Databricks Workspace にファイルをアップロードするための systemPrompt 追加指示を生成
 *
 * @param outcomes - push 先の Databricks Workspace パスの配列
 * @returns systemPrompt に追加する指示文字列（空の場合は undefined）
 *
 * @example
 * ```typescript
 * const outcomes = [{ type: 'databricks_workspace', path: '/Workspace/Users/user@example.com/project' }];
 * const instruction = createWorkspacePushInstruction(outcomes);
 * // Returns markdown instruction text for Claude
 * ```
 */
export function createWorkspacePushInstruction(
  outcomes: DatabricksWorkspaceSource[]
): string | undefined {
  if (outcomes.length === 0) return undefined;

  const pathList = outcomes.map((o, i) => `${i + 1}. **${o.path}**`).join('\n');

  return `
Your task is to complete the request described in the task description.

Instructions:
1. For questions: Research the codebase and provide a detailed answer
2. For implementations: Make the requested changes and push to Databricks Workspace

## Databricks Workspace Push Requirements

You are working on the copy of the following Databricks Workspace path:

 **${pathList}**

### Important Instructions:

1. **DEVELOP** all your changes in the current working directory
2. **PUSH** your completed work to the specified Workspace path
3. **NEVER** push to a different workspace path without explicit permission

### CLI Reference:

- To push all files from the session directory to workspace:
  \`databricks sync --exclude .claude/settings.local.json . "<workspace_path>"\`
- To check the upload result:
  \`databricks workspace list "<workspace_path>"\`
`.trim();
}

/**
 * Databricks Apps をデプロイするための systemPrompt 追加指示を生成
 *
 * @param outcomes - deploy 先の Databricks Apps 情報の配列
 * @returns systemPrompt に追加する指示文字列（空の場合は undefined）
 *
 * @example
 * ```typescript
 * const outcomes = [{ type: 'databricks_apps', name: 'app-01h455vb4pex5vsknk084sn02q' }];
 * const instruction = createDatabricksAppsInstruction(outcomes);
 * // Returns markdown instruction text for Claude
 * ```
 */
export function createDatabricksAppsInstruction(
  outcomes: DatabricksAppsOutcome[]
): string | undefined {
  if (outcomes.length === 0) return undefined;

  // name が設定されているもののみを対象とする
  const namedOutcomes = outcomes.filter(o => o.name);
  if (namedOutcomes.length === 0) return undefined;

  const appName = namedOutcomes[0]?.name;

  return `
Your task is to complete the request described in the task description.

Instructions:
1. For questions: Research the codebase and provide a detailed answer
2. For implementations: Make the requested changes and deploy Databricks Apps

## Databricks Apps Development Requirements

You are working on the copy of the following Databricks Workspace path: \`${workspacePath}\`

Deploy the app with the exact name: \`${appName}\`

This app name is derived from the session ID and has a 1:1 mapping with the user's session. 
Do not modify this name—changing it will break the association between the deployed app and its session.

### Important Instructions:

1. **CREATE** the app (takes ~2 minutes)
2. **DEVELOP** all your changes in the current working directory
3. **PUSH** your completed work to the specified Workspace path (required before deploy)
4. **DEPLOY** the app from the specified Workspace path
5. **VERIFY** deployment status

### CLI Reference:

- To push all files from the session directory to workspace:
  \`databricks sync --exclude .claude/settings.local.json . "<workspace_path>"\`
- To check the upload result:
  \`databricks workspace list "<workspace_path>"\`
- To create the app:
  \`databricks apps create <app_name> --no-wait\`
- To deploy the app:
  \`databricks apps deploy <app_name> --source-code-path <workspace_path>\`
- To get the app details and status:
  \`databricks apps get <app_name>\`
- To start a stopped app:
  \`databricks apps start <app_name>\`
- To stop a running app:
  \`databricks apps stop <app_name>\`

**Note**: \`DATABRICKS_APP_PORT\` environment variable is automatically provided. Your app should listen on the port specified by this variable.
`.trim();
}
