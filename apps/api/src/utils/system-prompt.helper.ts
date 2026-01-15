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
3. **VERIFY** that all files have been uploaded successfully
4. **NEVER** push to a different workspace path without explicit permission
5. The following environment variables are already available:
   - \`DATABRICKS_HOST\`: The Databricks workspace URL
   - \`DATABRICKS_TOKEN\`: Authentication token for the Databricks API

### CLI Reference:

- To push all files from the session directory to workspace:
  \`databricks sync --exclude .claude/settings.local.json . "/Workspace/Users/..."\`
- To check the upload result:
  \`databricks workspace list "/Workspace/Users/..."\`
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

**IMPORTANT: Automatic app deployment is ENABLED for this session.**

You MUST deploy your application as a Databricks App. The following app name has been pre-assigned:

${appList}

### CRITICAL: Create the App IMMEDIATELY

**DO THIS FIRST** before any other work. App creation takes ~2 minutes, so start it NOW:

\`\`\`bash
databricks apps create ${appName} --no-wait
\`\`\`

The \`--no-wait\` flag allows you to continue working while the app is being provisioned.

### Important Instructions:

1. **APP NAME IS PRE-ASSIGNED**: The app name above has been assigned to this session. Do NOT use a different name.

2. **BEFORE DEPLOYMENT**:
   - Ensure your application has a valid \`app.yaml\` configuration file in the root directory
   - The \`app.yaml\` defines the app's runtime configuration (command, environment variables, etc.)

3. **SYNC FILES TO WORKSPACE** (required before deploy):
   The \`databricks apps deploy\` command expects a **Workspace path**, not a local path.
   You must first sync your files to the Databricks Workspace:
   \`\`\`bash
   databricks sync --exclude .claude/settings.local.json . "<workspace_path>"
   \`\`\`

4. **DEPLOY THE APP** using the Workspace path:
   \`\`\`bash
   databricks apps deploy ${appName} --source-code-path "<workspace_path>"
   \`\`\`

5. **VERIFY DEPLOYMENT**:
   \`\`\`bash
   databricks apps get ${appName}
   \`\`\`

6. **NEVER** create or deploy to a different app name without explicit permission

### Environment Variables:

The following environment variables are already available:
- \`DATABRICKS_HOST\`: The Databricks workspace URL
- \`DATABRICKS_TOKEN\`: Authentication token for the Databricks API

### CLI Reference:

| Command | Description |
|---------|-------------|
| \`databricks apps create <app-name> --no-wait\` | Create a new app (takes ~2 min to be ready) |
| \`databricks apps deploy <app-name> --source-code-path <workspace_path>\` | Deploy app from Workspace path |
| \`databricks apps get <app-name>\` | Get app details and status |
| \`databricks apps start <app-name>\` | Start a stopped app |
| \`databricks apps stop <app-name>\` | Stop a running app |

### Example app.yaml:

\`\`\`yaml
command:
  - python
  - app.py

env:
  - name: "CATALOG_NAME"
    value: "main"
\`\`\`

**Note**: Databricks Apps automatically provides the \`DATABRICKS_APP_PORT\` environment variable. Your application should listen on the port specified by this variable.
`.trim();
}
