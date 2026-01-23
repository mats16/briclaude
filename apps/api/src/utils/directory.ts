import { mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

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
 *
 * @param targetPath - 削除するディレクトリのパス
 * @returns Promise<void>
 *
 * @remarks
 * セキュリティ: ユーザー入力に基づくパスを削除する場合は、
 * 事前に `validatePathWithinBase()` で検証してください。
 *
 * @example
 * ```typescript
 * // セキュアな削除（推奨）
 * const safePath = await validatePathWithinBase(userPath, ctx.userHome);
 * await removeDirectory(safePath);
 *
 * // 一時ディレクトリの削除（検証不要）
 * const tempDir = join(tmpdir(), `temp-${randomUUID()}`);
 * await removeDirectory(tempDir);
 * ```
 */
export async function removeDirectory(targetPath: string): Promise<void> {
  try {
    await rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    // ENOENT エラー以外は再スロー
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}
