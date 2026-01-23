import { realpath } from 'fs/promises';
import { resolve, sep, dirname, join } from 'path';

/**
 * パスが指定された基準ディレクトリ配下にあることを検証する
 *
 * @param targetPath - 検証するパス
 * @param baseDir - 基準ディレクトリ（絶対パス推奨）
 * @returns 正規化された絶対パス
 * @throws {Error} targetPath が baseDir の外にある場合
 *
 * @example
 * // ユーザーホーム配下のパスを検証
 * const safePath = await validatePathWithinBase(
 *   '/home/user/.claude/agents',
 *   '/home/user'
 * );
 * await removeDirectory(safePath);
 */
export async function validatePathWithinBase(targetPath: string, baseDir: string): Promise<string> {
  // 基準ディレクトリを正規化（必ず realpath で解決）
  const normalizedBase = await realpath(baseDir);

  // ターゲットパスを正規化
  let normalizedTarget: string;
  try {
    // 実際のファイルシステムを確認（シンボリックリンクも解決）
    normalizedTarget = await realpath(targetPath);
  } catch (error) {
    // ファイルが存在しない場合
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // 親ディレクトリが存在すれば、その realpath をベースに正規化
      const parentDir = dirname(targetPath);
      try {
        const normalizedParent = await realpath(parentDir);
        const basename = targetPath.substring(parentDir.length + 1);
        normalizedTarget = join(normalizedParent, basename);
      } catch {
        // 親も存在しない場合は resolve() にフォールバック
        normalizedTarget = resolve(targetPath);
      }
    } else {
      throw error;
    }
  }

  // baseDir 配下にあるかチェック
  const isWithinBase =
    normalizedTarget === normalizedBase || normalizedTarget.startsWith(normalizedBase + sep);

  if (!isWithinBase) {
    throw new Error(
      `Security error: Cannot access path outside of base directory. ` +
        `Target: ${normalizedTarget}, Base: ${normalizedBase}`
    );
  }

  return normalizedTarget;
}
