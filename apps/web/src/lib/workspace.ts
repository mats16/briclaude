/**
 * Workspace パス操作のユーティリティ関数
 */

// =====================================================
// Constants
// =====================================================

/** パンくずナビゲーションの最大幅（単一セグメント） */
export const BREADCRUMB_SEGMENT_MAX_WIDTH = 120;

/** パンくずナビゲーションの最大幅（最後のセグメント） */
export const BREADCRUMB_LAST_SEGMENT_MAX_WIDTH = 200;

/** 最近使用した Workspace の最大保存件数 */
export const MAX_RECENT_WORKSPACES = 4;

/** 許可されるベースパスのプレフィックス */
const ALLOWED_PATH_PREFIXES = ['/Workspace', '/Repos'] as const;

// =====================================================
// Path Utilities
// =====================================================

/**
 * パスから名前（最後のセグメント）を抽出
 * @param path - Workspace パス
 * @returns パスの最後のセグメント
 * @example
 * extractNameFromPath('/Workspace/Users/john/project') // => 'project'
 * extractNameFromPath('/Workspace') // => 'Workspace'
 * extractNameFromPath('') // => ''
 */
export function extractNameFromPath(path: string): string {
  if (!path) return '';
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? '';
}

/**
 * パスをセグメントに分割
 * @param path - Workspace パス
 * @returns セグメントの配列（各セグメントにフルパスを含む）
 * @example
 * splitPathToSegments('/Workspace/Users/john')
 * // => [
 * //   { name: 'Workspace', path: '/Workspace' },
 * //   { name: 'Users', path: '/Workspace/Users' },
 * //   { name: 'john', path: '/Workspace/Users/john' }
 * // ]
 */
export function splitPathToSegments(path: string): Array<{ name: string; path: string }> {
  const parts = path.split('/').filter(Boolean);
  return parts.map((name, index) => ({
    name,
    path: '/' + parts.slice(0, index + 1).join('/'),
  }));
}

// =====================================================
// Path Sanitization
// =====================================================

/**
 * パスインジェクション攻撃を防ぐためのパスサニタイズ
 * @param path - ユーザー入力のパス
 * @returns サニタイズされたパス
 * @throws パスが不正な場合はエラーをスロー
 */
export function sanitizePath(path: string): string {
  // 空文字列チェック
  if (!path || typeof path !== 'string') {
    throw new Error('Path is required');
  }

  // トリムして正規化
  let sanitized = path.trim();

  // トリム後も空文字列チェック
  if (!sanitized) {
    throw new Error('Path is required');
  }

  // パストラバーサル攻撃の検出（../ や ..\）
  if (sanitized.includes('..')) {
    throw new Error('Path traversal is not allowed');
  }

  // NULL バイトインジェクションの検出
  if (sanitized.includes('\0')) {
    throw new Error('Invalid path characters');
  }

  // 連続するスラッシュを正規化
  sanitized = sanitized.replace(/\/+/g, '/');

  // 末尾のスラッシュを削除（ルートパス以外）
  if (sanitized.length > 1 && sanitized.endsWith('/')) {
    sanitized = sanitized.slice(0, -1);
  }

  // 絶対パスであることを確認
  if (!sanitized.startsWith('/')) {
    sanitized = '/' + sanitized;
  }

  // 許可されたベースパスで始まることを確認
  const isAllowedPath = ALLOWED_PATH_PREFIXES.some(prefix => sanitized.startsWith(prefix));
  if (!isAllowedPath) {
    throw new Error(`Path must start with one of: ${ALLOWED_PATH_PREFIXES.join(', ')}`);
  }

  return sanitized;
}

/**
 * パスが有効かどうかをチェック（例外をスローしない）
 * @param path - チェックするパス
 * @returns 有効な場合は true
 */
export function isValidPath(path: string): boolean {
  try {
    sanitizePath(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * パスを安全にサニタイズ（エラー時はデフォルト値を返す）
 * @param path - サニタイズするパス
 * @param defaultPath - エラー時のデフォルトパス
 * @returns サニタイズされたパス、またはデフォルトパス
 */
export function safeSanitizePath(path: string, defaultPath: string = '/Workspace'): string {
  try {
    return sanitizePath(path);
  } catch {
    return defaultPath;
  }
}
