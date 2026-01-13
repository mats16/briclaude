import type { DatabricksWorkspaceSource } from '@repo/types';

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
