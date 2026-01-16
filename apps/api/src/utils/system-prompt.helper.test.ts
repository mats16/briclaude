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

  it('should include CLI reference with actual path', () => {
    const result = createWorkspacePushInstruction('/Workspace/test');

    expect(result).toContain('CLI Reference');
    expect(result).toContain('databricks workspace list "/Workspace/test"');
    expect(result).toContain(
      'databricks sync --exclude .claude/settings.local.json . "/Workspace/test"'
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
    const result = createDatabricksAppsInstruction('/Workspace/test', 'app-test123');

    expect(result).toContain('Databricks Apps');
    expect(result).toContain('app-test123');
    expect(result).toContain('/Workspace/test');
  });

  it('should include app name explanation', () => {
    const result = createDatabricksAppsInstruction('/Workspace/test', 'app-test');

    expect(result).toContain('session ID');
    expect(result).toContain('Do not modify this name');
  });

  it('should include databricks sync instruction', () => {
    const result = createDatabricksAppsInstruction('/Workspace/test', 'app-test');

    expect(result).toContain('databricks sync');
  });

  it('should include CLI reference', () => {
    const result = createDatabricksAppsInstruction('/Workspace/test', 'app-test');

    expect(result).toContain('CLI Reference');
    expect(result).toContain('databricks apps create');
    expect(result).toContain('databricks apps deploy');
    expect(result).toContain('databricks apps get');
  });

  it('should include task instructions', () => {
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
    const outcomes: SessionOutcome[] = [{ type: 'databricks_workspace', path: '/Workspace/test' }];

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
      { type: 'databricks_workspace', path: '/Workspace/test' },
      { type: 'databricks_apps', name: 'app-test' },
    ];

    const result = buildSystemPromptConfig(outcomes);

    expect(result.type).toBe('preset');
    expect(result.preset).toBe('claude_code');
    expect('append' in result).toBe(true);
    if ('append' in result) {
      // Apps instruction のみが使用される（排他）
      expect(result.append).toContain('Databricks Apps');
      expect(result.append).toContain('/Workspace/test');
      expect(result.append).toContain('app-test');
      // Workspace Push Requirements セクションは含まれない
      expect(result.append).not.toContain('Databricks Workspace Push Requirements');
    }
  });

  it('should return base config for databricks_apps without name', () => {
    const outcomes: SessionOutcome[] = [
      { type: 'databricks_workspace', path: '/Workspace/test' },
      { type: 'databricks_apps' },
    ];

    const result = buildSystemPromptConfig(outcomes);

    // name がない場合は Workspace instruction が使われる
    expect('append' in result).toBe(true);
    if ('append' in result) {
      expect(result.append).toContain('Databricks Workspace Push Requirements');
    }
  });

  it('should use first workspace path when multiple workspaces exist', () => {
    const outcomes: SessionOutcome[] = [
      { type: 'databricks_workspace', path: '/Workspace/first' },
      { type: 'databricks_workspace', path: '/Workspace/second' },
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
