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

  it('should not include Apps deployment reminder (handled by buildSystemPromptConfig)', () => {
    const outcomes: DatabricksWorkspaceSource[] = [
      { type: 'databricks_workspace', path: '/Workspace/test' },
    ];

    const result = createWorkspacePushInstruction(outcomes);

    // Apps デプロイの文言は createWorkspacePushInstruction には含まれない
    // buildSystemPromptConfig で両方の outcome がある場合にのみ追加される
    expect(result).not.toContain('you MUST proceed to create and deploy the Databricks App');
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

  it('should include MANDATORY emphasis', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('MANDATORY');
    expect(result).toContain('You MUST complete the following deployment steps');
  });

  it('should include critical rules about app name', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('DO NOT CHANGE');
    expect(result).toContain('Do NOT invent a new app name');
    expect(result).toContain('Do NOT use a name suggested by the user');
    expect(result).toContain('system-assigned name is required');
  });

  it('should include task completion reminder', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('Your task is NOT complete until all steps are finished');
    expect(result).toContain('Your work is NOT complete until the app is deployed and verified');
  });

  it('should include DATABRICKS_APP_PORT note', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('DATABRICKS_APP_PORT');
  });

  it('should include databricks sync instruction', () => {
    const outcomes: DatabricksAppsOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('databricks sync');
    expect(result).toContain('SYNC');
  });

  it('should skip outcomes without name but include those with name', () => {
    const outcomes: DatabricksAppsOutcome[] = [
      { type: 'databricks_apps' },
      { type: 'databricks_apps', name: 'app-valid' },
    ];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toBeDefined();
    expect(result).toContain('app-valid');
  });

  it('should use only first app when multiple apps provided', () => {
    const outcomes: DatabricksAppsOutcome[] = [
      { type: 'databricks_apps', name: 'app-first' },
      { type: 'databricks_apps', name: 'app-second' },
    ];

    const result = createDatabricksAppsInstruction(outcomes);

    expect(result).toContain('app-first');
    // Second app is not listed separately, only first is used
    expect(result).toContain('databricks apps create app-first');
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

  it('should combine both workspace and apps instructions with bridge reminder', () => {
    const outcomes: SessionOutcome[] = [
      { type: 'databricks_workspace', path: '/Workspace/test' },
      { type: 'databricks_apps', name: 'app-test' },
    ];

    const result = buildSystemPromptConfig(outcomes);

    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('Databricks Workspace Push Requirements');
      expect(result.append).toContain('Databricks Apps Deployment Requirements');
      // 両方がある場合にのみ bridge instruction が含まれる
      expect(result.append).toContain(
        'After pushing to Workspace, you MUST proceed to create and deploy the Databricks App'
      );
      expect(result.append).toContain('Your task is NOT complete until the app is deployed');
    }
  });

  it('should not include bridge reminder when only workspace outcome exists', () => {
    const outcomes: SessionOutcome[] = [{ type: 'databricks_workspace', path: '/Workspace/test' }];

    const result = buildSystemPromptConfig(outcomes);

    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('Databricks Workspace Push Requirements');
      expect(result.append).not.toContain('you MUST proceed to create and deploy the Databricks App');
    }
  });

  it('should not include bridge reminder when only apps outcome exists', () => {
    const outcomes: SessionOutcome[] = [{ type: 'databricks_apps', name: 'app-test' }];

    const result = buildSystemPromptConfig(outcomes);

    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('Databricks Apps Deployment Requirements');
      expect(result.append).not.toContain('After pushing to Workspace');
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
