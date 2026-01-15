import { describe, it, expect } from 'vitest';
import type { DatabricksWorkspaceSource, DatabricksAppsOutcome, SessionOutcome } from '@repo/types';
import {
  buildSystemPromptConfig,
  createWorkspacePushInstruction,
  createDatabricksAppsInstruction,
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

describe('createDatabricksAppsInstruction', () => {
  it('should return undefined for empty outcomes', () => {
    const result = createDatabricksAppsInstruction([]);
    expect(result).toBeUndefined();
  });

  it('should return undefined for outcomes without name', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toBeUndefined();
  });

  it('should generate instruction for single app', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test123' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toBeDefined();
    expect(result).toContain('Databricks Apps Deployment Requirements');
    expect(result).toContain('app-test123');
    expect(result).toContain('databricks apps create');
    expect(result).toContain('--no-wait');
    expect(result).toContain('databricks apps deploy');
  });

  it('should generate numbered list for multiple apps', () => {
    const outcomes: DatabricksAppsOutcome[] = [
      { type: 'databricks_apps', name: 'app-test1' },
      { type: 'databricks_apps', name: 'app-test2' },
    ];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('1. **app-test1**');
    expect(result).toContain('2. **app-test2**');
  });

  it('should include CLI reference section', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('### CLI Reference');
    expect(result).toContain('databricks apps get');
    expect(result).toContain('databricks apps create');
    expect(result).toContain('databricks apps deploy');
    expect(result).toContain('databricks apps start');
    expect(result).toContain('databricks apps stop');
  });

  it('should include environment variable information', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('DATABRICKS_HOST');
    expect(result).toContain('DATABRICKS_TOKEN');
  });

  it('should include app.yaml example and DATABRICKS_APP_PORT note', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('app.yaml');
    expect(result).toContain('DATABRICKS_APP_PORT');
  });

  it('should include databricks sync instruction before deploy', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('databricks sync');
    expect(result).toContain('SYNC FILES TO WORKSPACE');
    expect(result).toContain('Workspace path');
  });

  it('should skip outcomes without name but include those with name', () => {
    const outcomes: DatabricksAppsOutcome[] = [
      { type: 'databricks_apps' },
      { type: 'databricks_apps', name: 'app-valid' },
    ];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toBeDefined();
    expect(result).toContain('app-valid');
    expect(result).toContain('1. **app-valid**');
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

  it('should return config with append for databricks_apps outcomes', () => {
    const outcomes: SessionOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = buildSystemPromptConfig(outcomes);

    expect(result.type).toBe('preset');
    expect(result.preset).toBe('claude_code');
    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('Databricks Apps Deployment Requirements');
    }
  });

  it('should combine both workspace and apps instructions', () => {
    const outcomes: SessionOutcome[] = [
      { type: 'databricks_workspace', path: '/Workspace/test' },
      { type: 'databricks_apps', name: 'app-test' },
    ];

    const result = buildSystemPromptConfig(outcomes);

    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('Databricks Workspace Push Requirements');
      expect(result.append).toContain('Databricks Apps Deployment Requirements');
    }
  });

  it('should return base config for databricks_apps without name', () => {
    const outcomes: SessionOutcome[] = [{ type: 'databricks_apps' }];

    const result = buildSystemPromptConfig(outcomes);

    expect(result).toEqual({
      type: 'preset',
      preset: 'claude_code',
    });
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
