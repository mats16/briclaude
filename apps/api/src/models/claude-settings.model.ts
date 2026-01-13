import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ClaudeSettingsJson,
  ClaudeSettingsHookMatcher,
  ClaudeSettingsHooks,
} from '@repo/types';
import { ensureDirectoryForFile } from '../utils/directory.js';

/**
 * settings.local.json の保存に失敗した場合のエラー
 */
export class ClaudeSettingsSaveError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ClaudeSettingsSaveError';
  }
}

/**
 * Claude Code の settings.local.json を生成・管理するクラス
 *
 * @example
 * ```typescript
 * const settings = new ClaudeSettings();
 * settings.addSessionStartHook('databricks workspace export-dir /Workspace/path ./');
 * await settings.save('/path/to/.claude/settings.local.json');
 * ```
 */
export class ClaudeSettings {
  private hooks: ClaudeSettingsHooks = {};

  /**
   * SessionStart hook を追加
   * @param command - 実行するコマンド
   * @returns this（メソッドチェーン用）
   */
  addSessionStartHook(command: string): this {
    if (!this.hooks.SessionStart) {
      this.hooks.SessionStart = [];
    }

    const matcher: ClaudeSettingsHookMatcher = {
      hooks: [{ type: 'command', command }],
    };

    this.hooks.SessionStart.push(matcher);
    return this;
  }

  /**
   * 複数の SessionStart hook を追加
   * @param commands - 実行するコマンドの配列
   * @returns this（メソッドチェーン用）
   */
  addSessionStartHooks(commands: string[]): this {
    commands.forEach(cmd => this.addSessionStartHook(cmd));
    return this;
  }

  /**
   * JSON オブジェクトとしてエクスポート
   * @returns ClaudeSettingsJson オブジェクト
   */
  toJson(): ClaudeSettingsJson {
    const json: ClaudeSettingsJson = {};

    if (Object.keys(this.hooks).length > 0) {
      json.hooks = this.hooks;
    }

    return json;
  }

  /**
   * 指定パスに settings.local.json を保存
   * @param filePath - 保存先のフルパス（通常は .claude/settings.local.json）
   * @throws {ClaudeSettingsSaveError} ファイル書き込みに失敗した場合
   */
  async save(filePath: string): Promise<void> {
    try {
      await ensureDirectoryForFile(filePath);
      const json = this.toJson();
      await writeFile(filePath, JSON.stringify(json, null, 2), 'utf-8');
    } catch (error) {
      throw new ClaudeSettingsSaveError(
        `Failed to save settings to ${filePath}`,
        filePath,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * cwd 配下の .claude/settings.local.json に保存するヘルパー
   * @param cwd - セッションの作業ディレクトリ
   * @throws {ClaudeSettingsSaveError} ファイル書き込みに失敗した場合
   */
  async saveToSession(cwd: string): Promise<void> {
    const settingsPath = path.join(cwd, '.claude', 'settings.local.json');
    await this.save(settingsPath);
  }

  /**
   * Databricks Workspace からファイルを取得するための SessionStart hook コマンドを生成
   *
   * @param workspacePath - Databricks Workspace のパス（例: /Workspace/Users/user@example.com/project）
   * @returns databricks workspace export-dir コマンド文字列
   *
   * @example
   * ```typescript
   * const cmd = ClaudeSettings.createWorkspaceExportCommand('/Workspace/Users/user/project');
   * // => 'databricks workspace export-dir "/Workspace/Users/user/project" . --overwrite'
   * ```
   */
  static createWorkspaceExportCommand(workspacePath: string): string {
    // databricks workspace export-dir は --overwrite オプションで既存ファイルを上書き
    return `databricks workspace export-dir "${workspacePath}" . --overwrite`;
  }
}
