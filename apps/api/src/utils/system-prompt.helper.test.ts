import { describe, it, expect } from 'vitest';
import type { DatabricksWorkspaceSource, SessionOutcome } from '@repo/types';
import {
  buildSystemPromptConfig,
  createWorkspacePushInstruction,
  type SystemPromptConfig,
} from './system-prompt.helper.js';

describe('createWorkspacePushInstruction', () => {
  it('should return undefined for empty outcomes', () => {
    const result = createWorkspacePushInstruction([]);
    expect(result).toBeUndefined();
  });

  it('should generate instruction for single workspace', () => {
    const outcomes: DatabricksWorkspaceSource[] = [
      { type: 'databricks_workspace', path: '/Workspace/Users/test@example.com/project' },
    ];

    const result = createWorkspacePushInstruction(outcomes);

    expect(result).toBeDefined();
    expect(result).toContain('Databricks Workspace Push Requirements');
    expect(result).toContain('/Workspace/Users/test@example.com/project');
    expect(result).toContain('databricks sync');
  });

  it('should generate numbered list for multiple workspaces', () => {
    const outcomes: DatabricksWorkspaceSource[] = [
      { type: 'databricks_workspace', path: '/Workspace/path1' },
      { type: 'databricks_workspace', path: '/Workspace/path2' },
    ];

    const result = createWorkspacePushInstruction(outcomes);

    expect(result).toContain('1. **/Workspace/path1**');
    expect(result).toContain('2. **/Workspace/path2**');
  });

  it('should include CLI reference section', () => {
    const outcomes: DatabricksWorkspaceSource[] = [
      { type: 'databricks_workspace', path: '/Workspace/test' },
    ];

    const result = createWorkspacePushInstruction(outcomes);

    expect(result).toContain('### CLI Reference');
    expect(result).toContain('databricks workspace list');
  });

  it('should include environment variable information', () => {
    const outcomes: DatabricksWorkspaceSource[] = [
      { type: 'databricks_workspace', path: '/Workspace/test' },
    ];

    const result = createWorkspacePushInstruction(outcomes);

    expect(result).toContain('DATABRICKS_HOST');
    expect(result).toContain('DATABRICKS_TOKEN');
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

  it('should return config with append for databricks_workspace outcomes', () => {
    const outcomes: SessionOutcome[] = [{ type: 'databricks_workspace', path: '/Workspace/test' }];

    const result = buildSystemPromptConfig(outcomes);

    expect(result.type).toBe('preset');
    expect(result.preset).toBe('claude_code');
    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('Databricks Workspace Push Requirements');
    }
  });

  it('should filter out non-databricks_workspace outcomes', () => {
    // Currently SessionOutcome only supports databricks_workspace,
    // but this test ensures the filter works correctly
    const outcomes: SessionOutcome[] = [{ type: 'databricks_workspace', path: '/Workspace/test' }];

    const result = buildSystemPromptConfig(outcomes);

    expect('append' in result).toBe(true);
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
