import type { DatabricksWorkspaceSource } from '@repo/types';

/**
 * Databricks Workspace にファイルをアップロードするための systemPrompt 追加指示を生成
 *
 * @param outcomes - push 先の Databricks Workspace パスの配列
 * @param cwd - セッションの作業ディレクトリ
 * @returns systemPrompt に追加する指示文字列（空の場合は undefined）
 *
 * @example
 * ```typescript
 * const outcomes = [{ type: 'databricks_workspace', path: '/Workspace/Users/user@example.com/project' }];
 * const instruction = createWorkspacePushInstruction(outcomes, '/home/app/users/user1/session_abc');
 * // Returns markdown instruction text for Claude
 * ```
 */
export function createWorkspacePushInstruction(
  outcomes: DatabricksWorkspaceSource[],
  cwd: string
): string | undefined {
  if (outcomes.length === 0) return undefined;

  const pathList = outcomes.map((o, i) => `${i + 1}. **${o.path}**`).join('\n');

  // セキュリティ: パスのサニタイズ（バッククォートをエスケープ）
  const sanitizedCwd = cwd.replace(/`/g, '\\`');

  return `
## Databricks Workspace Push Requirements

You are expected to push your completed work to the following Databricks Workspace paths:

${pathList}

### Important Instructions:

1. **DEVELOP** all your changes in the current working directory (\`${sanitizedCwd}\`)
2. **PUSH** your completed work to the specified Databricks Workspace path(s) using the Databricks CLI:
   \`\`\`bash
   databricks workspace import-dir "${sanitizedCwd}" "<workspace_path>" --overwrite
   \`\`\`
3. **VERIFY** that all files have been uploaded successfully
4. **NEVER** push to a different workspace path without explicit permission
5. The following environment variables are already available:
   - \`DATABRICKS_HOST\`: The Databricks workspace URL
   - \`DATABRICKS_TOKEN\`: Authentication token for the Databricks API

### CLI Reference:

- To push all files from the session directory to workspace:
  \`databricks workspace import-dir "${sanitizedCwd}" "/Workspace/Users/..." --overwrite\`
- To check the upload result:
  \`databricks workspace ls "/Workspace/Users/..."\`
`.trim();
}
