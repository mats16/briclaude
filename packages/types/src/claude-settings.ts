// =====================================================
// Claude Settings Hook Types
// =====================================================

/**
 * コマンドタイプの Hook
 * SessionStart 等で実行するシェルコマンドを指定
 */
export interface ClaudeSettingsHookCommand {
  type: 'command';
  command: string;
}

/**
 * プロンプトタイプの Hook（将来の拡張用）
 */
export interface ClaudeSettingsHookPrompt {
  type: 'prompt';
  prompt: string;
}

/**
 * Hook の種類（command または prompt）
 */
export type ClaudeSettingsHook = ClaudeSettingsHookCommand | ClaudeSettingsHookPrompt;

/**
 * Hook マッチャー
 * 特定のツール名やパターンにマッチした場合に実行される Hook を定義
 */
export interface ClaudeSettingsHookMatcher {
  /** ツール名のマッチパターン（"*" で全ツール、SessionStart では不要） */
  matcher?: string;
  /** 実行する Hook の配列 */
  hooks: ClaudeSettingsHook[];
}

/**
 * 利用可能な Hook タイプ
 */
export type ClaudeSettingsHookType =
  | 'SessionStart'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PermissionRequest'
  | 'PreCompact'
  | 'Stop'
  | 'SubagentStop'
  | 'UserPromptSubmit';

/**
 * Hooks 設定
 * 各 Hook タイプに対して HookMatcher の配列を指定
 */
export type ClaudeSettingsHooks = Partial<
  Record<ClaudeSettingsHookType, ClaudeSettingsHookMatcher[]>
>;

// =====================================================
// Claude Settings JSON Structure
// =====================================================

/**
 * settings.local.json の構造
 * Claude Code が読み込む設定ファイルの型定義
 */
export interface ClaudeSettingsJson {
  /** 環境変数設定 */
  env?: Record<string, string>;
  /** パーミッション設定 */
  permissions?: {
    /** 許可するパターンの配列（例: "Bash(databricks:*)"） */
    allow?: string[];
    /** 拒否するパターンの配列 */
    deny?: string[];
  };
  /** Hooks 設定 */
  hooks?: ClaudeSettingsHooks;
}
