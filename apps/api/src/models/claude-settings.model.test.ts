import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeSettings, ClaudeSettingsSaveError } from './claude-settings.model.js';
import * as fs from 'node:fs/promises';
import * as directory from '../utils/directory.js';

// Mock fs and directory utils
vi.mock('node:fs/promises');
vi.mock('../utils/directory.js');

describe('ClaudeSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addSessionStartHook', () => {
    it('should add a single SessionStart hook', () => {
      const settings = new ClaudeSettings();
      settings.addSessionStartHook('echo "hello"');

      const json = settings.toJson();
      expect(json.hooks?.SessionStart).toHaveLength(1);
      expect(json.hooks?.SessionStart?.[0].hooks[0]).toEqual({
        type: 'command',
        command: 'echo "hello"',
      });
    });

    it('should support method chaining', () => {
      const settings = new ClaudeSettings();
      const result = settings.addSessionStartHook('command1').addSessionStartHook('command2');

      expect(result).toBe(settings);
      expect(settings.toJson().hooks?.SessionStart).toHaveLength(2);
    });
  });

  describe('addSessionStartHooks', () => {
    it('should add multiple SessionStart hooks at once', () => {
      const settings = new ClaudeSettings();
      settings.addSessionStartHooks(['cmd1', 'cmd2', 'cmd3']);

      const json = settings.toJson();
      expect(json.hooks?.SessionStart).toHaveLength(3);
    });

    it('should handle empty array', () => {
      const settings = new ClaudeSettings();
      settings.addSessionStartHooks([]);

      const json = settings.toJson();
      expect(json.hooks).toBeUndefined();
    });
  });

  describe('toJson', () => {
    it('should return empty object when no hooks are added', () => {
      const settings = new ClaudeSettings();
      expect(settings.toJson()).toEqual({});
    });

    it('should include hooks when added', () => {
      const settings = new ClaudeSettings();
      settings.addSessionStartHook('test-command');

      const json = settings.toJson();
      expect(json).toHaveProperty('hooks');
      expect(json.hooks).toHaveProperty('SessionStart');
    });
  });

  describe('save', () => {
    it('should save settings to file', async () => {
      const mockWriteFile = vi.mocked(fs.writeFile);
      const mockEnsureDir = vi.mocked(directory.ensureDirectoryForFile);

      mockEnsureDir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const settings = new ClaudeSettings();
      settings.addSessionStartHook('test');

      await settings.save('/path/to/settings.json');

      expect(mockEnsureDir).toHaveBeenCalledWith('/path/to/settings.json');
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/path/to/settings.json',
        expect.any(String),
        'utf-8'
      );
    });

    it('should throw ClaudeSettingsSaveError on failure', async () => {
      const mockEnsureDir = vi.mocked(directory.ensureDirectoryForFile);
      mockEnsureDir.mockRejectedValue(new Error('Permission denied'));

      const settings = new ClaudeSettings();

      await expect(settings.save('/invalid/path')).rejects.toThrow(ClaudeSettingsSaveError);
      await expect(settings.save('/invalid/path')).rejects.toMatchObject({
        filePath: '/invalid/path',
        name: 'ClaudeSettingsSaveError',
      });
    });
  });

  describe('saveToSession', () => {
    it('should save to correct path under cwd', async () => {
      const mockWriteFile = vi.mocked(fs.writeFile);
      const mockEnsureDir = vi.mocked(directory.ensureDirectoryForFile);

      mockEnsureDir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const settings = new ClaudeSettings();
      await settings.saveToSession('/home/user/session');

      expect(mockEnsureDir).toHaveBeenCalledWith('/home/user/session/.claude/settings.local.json');
    });
  });

  describe('createWorkspaceExportCommand', () => {
    it('should generate correct export command', () => {
      const cmd = ClaudeSettings.createWorkspaceExportCommand('/Workspace/Users/test/project');
      expect(cmd).toBe(
        'databricks workspace export-dir "/Workspace/Users/test/project" . --overwrite'
      );
    });

    it('should handle paths with special characters', () => {
      const cmd = ClaudeSettings.createWorkspaceExportCommand(
        '/Workspace/Users/user@example.com/my project'
      );
      expect(cmd).toContain('user@example.com');
      expect(cmd).toContain('my project');
    });
  });
});

describe('ClaudeSettingsSaveError', () => {
  it('should have correct properties', () => {
    const cause = new Error('Original error');
    const error = new ClaudeSettingsSaveError('Test message', '/path/to/file', cause);

    expect(error.name).toBe('ClaudeSettingsSaveError');
    expect(error.message).toBe('Test message');
    expect(error.filePath).toBe('/path/to/file');
    expect(error.cause).toBe(cause);
  });
});
