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

  // 両方の instruction がある場合、Workspace Push 後に Apps デプロイを促す
  const bridgeInstruction =
    workspaceInstruction && appsInstruction
      ? '⚠️ **After pushing to Workspace, you MUST proceed to create and deploy the Databricks App.** Your task is NOT complete until the app is deployed.'
      : undefined;

  // instruction を結合（存在する場合のみ）
  const instructions = [workspaceInstruction, bridgeInstruction, appsInstruction].filter(Boolean);
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

  const appName = namedOutcomes[0]?.name;

  return `
## Databricks Apps Deployment Requirements

⚠️ **MANDATORY: You MUST complete the following deployment steps.**

### Pre-assigned App Name (DO NOT CHANGE)

\`${appName}\`

This name is **system-generated** and linked to your session.

**CRITICAL RULES**:
- Do NOT invent a new app name (e.g., "my-app", "sample-app")
- Do NOT use a name suggested by the user - the system-assigned name is required
- Using a different name will break deployment tracking and session management

### Deployment Steps (ALL REQUIRED)

Your task is NOT complete until all steps are finished:

1. **CREATE** the app (takes ~2 minutes):
   \`\`\`bash
   databricks apps create ${appName} --no-wait
   \`\`\`

2. **SYNC** files to Workspace (required before deploy):
   \`\`\`bash
   databricks sync --exclude .claude/settings.local.json . "<workspace_path>"
   \`\`\`

3. **DEPLOY** the app:
   \`\`\`bash
   databricks apps deploy ${appName} --source-code-path "<workspace_path>"
   \`\`\`

4. **VERIFY** deployment status:
   \`\`\`bash
   databricks apps get ${appName}
   \`\`\`

⚠️ **Your work is NOT complete until the app is deployed and verified.**

**Note**: \`DATABRICKS_APP_PORT\` environment variable is automatically provided.
`.trim();
}
