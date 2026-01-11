import { mkdir, rm } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

/**
 * 指定したパスのディレクトリを再帰的に作成します。
 * ディレクトリが既に存在する場合はエラーを投げません。
 *
 * @param path - 作成するディレクトリのパス
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * await ensureDirectory('/path/to/nested/directory');
 * ```
 */
export async function ensureDirectory(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: true });
  } catch (error) {
    // EEXIST エラー以外は再スロー
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * ファイルパスから親ディレクトリを再帰的に作成します。
 * ファイルを作成する前に親ディレクトリを確保するのに便利です。
 *
 * @param filePath - ファイルのパス
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * await ensureDirectoryForFile('/path/to/file.txt');
 * // /path/to/ ディレクトリが作成されます
 * ```
 */
export async function ensureDirectoryForFile(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await ensureDirectory(dir);
}

/**
 * 指定したパスのディレクトリを再帰的に削除します。
 * ディレクトリが存在しない場合はエラーを投げません。
 * セキュリティのため、baseDir が指定された場合はその配下のみ削除可能です。
 *
 * @param targetPath - 削除するディレクトリのパス
 * @param baseDir - 削除を許可するベースディレクトリ（指定時はこの配下のみ削除可能）
 * @returns Promise<void>
 * @throws Error - targetPath が baseDir 配下でない場合
 *
 * @example
 * ```typescript
 * // baseDir なし（任意のパスを削除可能 - 非推奨）
 * await removeDirectory('/path/to/directory');
 *
 * // baseDir あり（セキュア - 推奨）
 * await removeDirectory('/home/user/session_xxx', '/home/user');
 * ```
 */
export async function removeDirectory(targetPath: string, baseDir?: string): Promise<void> {
  // baseDir が指定されている場合、パストラバーサル攻撃を防ぐ
  if (baseDir) {
    const normalizedBase = resolve(baseDir);
    const normalizedTarget = resolve(targetPath);

    // normalizedTarget が normalizedBase 配下にあるかチェック
    const isWithinBase =
      normalizedTarget === normalizedBase ||
      normalizedTarget.startsWith(normalizedBase + sep);

    if (!isWithinBase) {
      throw new Error(
        `Security error: Cannot delete path outside of base directory. ` +
          `Target: ${normalizedTarget}, Base: ${normalizedBase}`
      );
    }
  }

  try {
    await rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    // ENOENT エラー以外は再スロー
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
