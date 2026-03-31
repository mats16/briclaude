import { describe, it, expect } from 'vitest';
import type { SessionOutcome } from '@repo/types';
import {
  buildSystemPromptConfig,
  createWorkspacePushInstruction,
  createDatabricksAppsInstruction,
  type SystemPromptConfig,
} from './system-prompt.helper.js';

describe('createWorkspacePushInstruction', () => {
  it('should generate instruction with workspace path', () => {
    const result = createWorkspacePushInstruction('/Workspace/Users/test@example.com/project');

    expect(result).toContain('Databricks Workspace Push Requirements');
    expect(result).toContain('/Workspace/Users/test@example.com/project');
    expect(result).toContain('databricks sync');
  });

  it('should include CLI reference with environment variable', () => {
    const result = createWorkspacePushInstruction('/Workspace/test');

    expect(result).toContain('CLI Reference');
    expect(result).toContain('DATABRICKS_WORKSPACE_PATH');
    expect(result).toContain('databricks workspace list "$DATABRICKS_WORKSPACE_PATH"');
    expect(result).toContain(
      'databricks sync --include "*" --exclude .claude/settings.local.json . "$DATABRICKS_WORKSPACE_PATH"'
    );
  });

  it('should include task instructions', () => {
    const result = createWorkspacePushInstruction('/Workspace/test');

    expect(result).toContain('Your task is to complete the request');
    expect(result).toContain('DEVELOP');
    expect(result).toContain('PUSH');
  });
});

describe('createDatabricksAppsInstruction', () => {
  it('should generate instruction with workspace path and app name', () => {
    const result = createDatabricksAppsInstruction('/Workspace/test', 'app-abc123');

    expect(result).toContain('Databricks Apps');
    expect(result).toContain('/Workspace/test');
    expect(result).toContain('app-abc123');
  });

  it('should include app name in environment variable format', () => {
    const result = createDatabricksAppsInstruction('/Workspace/test', 'my-app');

    expect(result).toContain('DATABRICKS_APP_NAME');
    expect(result).toContain('my-app');
  });

  it('should include databricks sync instruction', () => {
    const result = createDatabricksAppsInstruction('/Workspace/test', 'app-test');

    expect(result).toContain('databricks sync');
  });

  it('should include CLI reference with databricks apps commands', () => {
    const result = createDatabricksAppsInstruction('/Workspace/test', 'app-test');

    expect(result).toContain('CLI Reference');
    expect(result).toContain('databricks apps create $DATABRICKS_APP_NAME');
    expect(result).toContain(
      'databricks apps deploy $DATABRICKS_APP_NAME --source-code-path $DATABRICKS_WORKSPACE_PATH'
    );
    expect(result).toContain('databricks apps get $DATABRICKS_APP_NAME');
    // MCP ツールは含まれない
    expect(result).not.toContain('mcp__dbapps__');
  });

  it('should include task instructions with CREATE step', () => {
    const result = createDatabricksAppsInstruction('/Workspace/test', 'app-test');

    expect(result).toContain('Your task is to complete the request');
    expect(result).toContain('CREATE');
    expect(result).toContain('DEVELOP');
    expect(result).toContain('PUSH');
    expect(result).toContain('DEPLOY');
    expect(result).toContain('VERIFY');
  });
});

describe('buildSystemPromptConfig', () => {
  it('should return base config for empty outcomes', () => {
    const result = buildSystemPromptConfig([]);

    expect(result).toEqual({
      type: 'preset',
      preset: 'claude_code',
    });
  });

  it('should return base config for undefined outcomes', () => {
    const result = buildSystemPromptConfig();

    expect(result).toEqual({
      type: 'preset',
      preset: 'claude_code',
    });
  });

  it('should return config with Workspace instruction for workspace-only outcome', () => {
    const outcomes: SessionOutcome[] = [
      { type: 'databricks_workspace', path: '/Workspace/test', id: 12345 },
    ];

    const result = buildSystemPromptConfig(outcomes);

    expect(result.type).toBe('preset');
    expect(result.preset).toBe('claude_code');
    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('Databricks Workspace Push Requirements');
      expect(result.append).not.toContain('databricks apps create');
    }
  });

  it('should return config with Apps instruction when both workspace and apps outcomes exist', () => {
    const outcomes: SessionOutcome[] = [
      { type: 'databricks_workspace', path: '/Workspace/test', id: 12345 },
      { type: 'databricks_apps', name: 'app-abc123' },
    ];

    const result = buildSystemPromptConfig(outcomes);

    expect(result.type).toBe('preset');
    expect(result.preset).toBe('claude_code');
    expect('append' in result).toBe(true);
    if ('append' in result) {
      // Apps instruction のみが使用される（排他）
      expect(result.append).toContain('Databricks Apps');
      expect(result.append).toContain('/Workspace/test');
      expect(result.append).toContain('app-abc123');
      expect(result.append).toContain('CLI Reference');
      expect(result.append).toContain('databricks apps create $DATABRICKS_APP_NAME');
      // MCP ツールは含まれない
      expect(result.append).not.toContain('mcp__dbapps__');
      // Workspace Push Requirements セクションは含まれない
      expect(result.append).not.toContain('Databricks Workspace Push Requirements');
    }
  });

  it('should use "unknown" as app name when databricks_apps has no name', () => {
    const outcomes: SessionOutcome[] = [
      { type: 'databricks_workspace', path: '/Workspace/test', id: 12345 },
      { type: 'databricks_apps' },
    ];

    const result = buildSystemPromptConfig(outcomes);

    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('Databricks Apps');
      expect(result.append).toContain('unknown');
      expect(result.append).toContain('databricks apps create $DATABRICKS_APP_NAME');
    }
  });

  it('should use first workspace path when multiple workspaces exist', () => {
    const outcomes: SessionOutcome[] = [
      { type: 'databricks_workspace', path: '/Workspace/first', id: 12345 },
      { type: 'databricks_workspace', path: '/Workspace/second', id: 67890 },
    ];

    const result = buildSystemPromptConfig(outcomes);

    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('/Workspace/first');
    }
  });
});

describe('SystemPromptConfig type', () => {
  it('should match expected structure without append', () => {
    const config: SystemPromptConfig = {
      type: 'preset',
      preset: 'claude_code',
    };

    expect(config.type).toBe('preset');
    expect(config.preset).toBe('claude_code');
  });

  it('should match expected structure with append', () => {
    const config: SystemPromptConfig = {
      type: 'preset',
      preset: 'claude_code',
      append: 'Additional instructions',
    };

    expect(config.type).toBe('preset');
    expect(config.preset).toBe('claude_code');
    expect(config.append).toBe('Additional instructions');
  });
});
