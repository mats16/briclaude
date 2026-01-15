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

  // 両方の instruction を結合（存在する場合のみ）
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
## Databricks Workspace Push Requirements

You are expected to push your completed work to the following Databricks Workspace paths:

${pathList}

### Important Instructions:

1. **DEVELOP** all your changes in the current working directory

2. **PUSH** your completed work to the specified Databricks Workspace path(s) using the Databricks CLI:
   \`\`\`bash
   databricks sync --exclude .claude/settings.local.json . "<workspace_path>"
   \`\`\`

3. **NEVER** push to a different workspace path without explicit permission
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

  const appList = namedOutcomes.map((o, i) => `${i + 1}. **${o.name}**`).join('\n');
  const appName = namedOutcomes[0]?.name;

  return `
## Databricks Apps Deployment Requirements (Auto-Deploy Enabled)

You are expected to deploy your application as pre-assigned app name:

${appList}

### Important Instructions:

1. **CREATE**: before any other work, create the app using the Databricks CLI:
   \`\`\`bash
   databricks apps create ${appName} --no-wait
   \`\`\`
   It takes ~2 minutes

2. **SYNC** (required before deploy):
   The \`databricks apps deploy\` command expects a **Workspace path**, not a local path.
   You must first sync your files to the Databricks Workspace:
   \`\`\`bash
   databricks sync --exclude .claude/settings.local.json . "<workspace_path>"
   \`\`\`

3. **DEPLOY** deploy the app using the Databricks CLI:
   \`\`\`bash
   databricks apps deploy ${appName} --source-code-path "<workspace_path>"
   \`\`\`
   **Notice**: Do not forget to deploy. Syncing alone is not sufficient—the app will not work without deployment.

4. **STATUS**: get deployment status using the Databricks CLI:
   \`\`\`bash
   databricks apps get ${appName}
   \`\`\`

5. **NEVER** create or deploy to a different app name without explicit permission

**Note**: Databricks Apps automatically provides the \`DATABRICKS_APP_PORT\` environment variable. Your application should listen on the port specified by this variable.
`.trim();
}
