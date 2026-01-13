import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ClaudeSettingsJson,
  ClaudeSettingsHookMatcher,
  ClaudeSettingsHooks,
} from '@repo/types';
import { ensureDirectoryForFile } from '../utils/directory.js';

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

    if (this.hooks && Object.keys(this.hooks).length > 0) {
      json.hooks = this.hooks;
    }

    return json;
  }

  /**
   * 指定パスに settings.local.json を保存
   * @param filePath - 保存先のフルパス（通常は .claude/settings.local.json）
   */
  async save(filePath: string): Promise<void> {
    await ensureDirectoryForFile(filePath);
    const json = this.toJson();
    await writeFile(filePath, JSON.stringify(json, null, 2), 'utf-8');
  }

  /**
   * cwd 配下の .claude/settings.local.json に保存するヘルパー
   * @param cwd - セッションの作業ディレクトリ
   */
  async saveToSession(cwd: string): Promise<void> {
    const settingsPath = path.join(cwd, '.claude', 'settings.local.json');
    await this.save(settingsPath);
  }

  /**
   * Databricks Workspace からファイルを取得するための SessionStart hook コマンドを生成
   *
   * @param workspacePath - Databricks Workspace のパス（例: /Workspace/Users/user@example.com/project）
   * @param localDir - ローカルの出力先ディレクトリ（デフォルト: カレントディレクトリ）
   * @returns databricks workspace export-dir コマンド文字列
   *
   * @example
   * ```typescript
   * const cmd = ClaudeSettings.createWorkspaceExportCommand('/Workspace/Users/user/project', '/home/user/session');
   * // => 'databricks workspace export-dir "/Workspace/Users/user/project" "/home/user/session" --overwrite'
   * ```
   */
  static createWorkspaceExportCommand(workspacePath: string, localDir: string = '.'): string {
    // セキュリティ: パスのサニタイズ（ダブルクォートをエスケープ）
    const sanitizedPath = workspacePath.replace(/"/g, '\\"');
    const sanitizedLocalDir = localDir.replace(/"/g, '\\"');

    // databricks workspace export-dir は --overwrite オプションで既存ファイルを上書き
    return `databricks workspace export-dir "${sanitizedPath}" "${sanitizedLocalDir}" --overwrite`;
  }
}
