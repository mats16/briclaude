// apps/api/src/utils/directory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ensureDirectory, ensureDirectoryForFile, removeDirectory } from './directory.js';

describe('directory utilities', () => {
  let testBaseDir: string;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    testBaseDir = join(tmpdir(), `test-dir-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    // テスト後にクリーンアップ
    try {
      await rm(testBaseDir, { recursive: true, force: true });
    } catch {
      // 既に削除されている場合は無視
    }
  });

  describe('ensureDirectory', () => {
    it('should create a new directory', async () => {
      const targetDir = join(testBaseDir, 'new-dir');

      await ensureDirectory(targetDir);

      const stats = await stat(targetDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create nested directories', async () => {
      const targetDir = join(testBaseDir, 'level1', 'level2', 'level3');

      await ensureDirectory(targetDir);

      const stats = await stat(targetDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not throw if directory already exists', async () => {
      const targetDir = join(testBaseDir, 'existing-dir');
      await mkdir(targetDir);

      await expect(ensureDirectory(targetDir)).resolves.not.toThrow();
    });
  });

  describe('ensureDirectoryForFile', () => {
    it('should create parent directory for file path', async () => {
      const filePath = join(testBaseDir, 'parent', 'file.txt');

      await ensureDirectoryForFile(filePath);

      const parentDir = join(testBaseDir, 'parent');
      const stats = await stat(parentDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('removeDirectory', () => {
    it('should remove an existing directory', async () => {
      const targetDir = join(testBaseDir, 'to-remove');
      await mkdir(targetDir);

      await removeDirectory(targetDir);

      await expect(stat(targetDir)).rejects.toThrow();
    });

    it('should remove a directory with contents', async () => {
      const targetDir = join(testBaseDir, 'to-remove-with-contents');
      await mkdir(targetDir);
      await writeFile(join(targetDir, 'file.txt'), 'test content');
      await mkdir(join(targetDir, 'subdir'));
      await writeFile(join(targetDir, 'subdir', 'nested.txt'), 'nested content');

      await removeDirectory(targetDir);

      await expect(stat(targetDir)).rejects.toThrow();
    });

    it('should not throw if directory does not exist', async () => {
      const targetDir = join(testBaseDir, 'non-existent');

      await expect(removeDirectory(targetDir)).resolves.not.toThrow();
    });

    describe('security checks with baseDir', () => {
      it('should allow deletion within baseDir', async () => {
        const targetDir = join(testBaseDir, 'allowed');
        await mkdir(targetDir);

        await removeDirectory(targetDir, testBaseDir);

        await expect(stat(targetDir)).rejects.toThrow();
      });

      it('should allow deletion when target equals baseDir', async () => {
        const subDir = join(testBaseDir, 'subdir');
        await mkdir(subDir);

        await removeDirectory(subDir, subDir);

        await expect(stat(subDir)).rejects.toThrow();
      });

      it('should throw error for path traversal attack (..)', async () => {
        const baseDir = join(testBaseDir, 'base');
        const targetDir = join(testBaseDir, 'base', '..', 'outside');
        await mkdir(baseDir);

        await expect(removeDirectory(targetDir, baseDir)).rejects.toThrow(
          'Security error: Cannot delete path outside of base directory'
        );
      });

      it('should throw error for path outside baseDir', async () => {
        const baseDir = join(testBaseDir, 'base');
        const outsideDir = join(testBaseDir, 'outside');
        await mkdir(baseDir);
        await mkdir(outsideDir);

        await expect(removeDirectory(outsideDir, baseDir)).rejects.toThrow(
          'Security error: Cannot delete path outside of base directory'
        );
      });

      it('should throw error for absolute path outside baseDir', async () => {
        const baseDir = join(testBaseDir, 'base');
        await mkdir(baseDir);

        await expect(removeDirectory('/etc/passwd', baseDir)).rejects.toThrow(
          'Security error: Cannot delete path outside of base directory'
        );
      });

      it('should handle nested paths within baseDir', async () => {
        const baseDir = join(testBaseDir, 'base');
        const nestedDir = join(baseDir, 'level1', 'level2', 'level3');
        await mkdir(nestedDir, { recursive: true });

        await removeDirectory(nestedDir, baseDir);

        await expect(stat(nestedDir)).rejects.toThrow();
      });

      it('should throw for similarly named directories outside baseDir', async () => {
        // baseDir: /tmp/test/base
        // targetDir: /tmp/test/base-other (not inside base, just similarly named)
        const baseDir = join(testBaseDir, 'base');
        const similarDir = join(testBaseDir, 'base-other');
        await mkdir(baseDir);
        await mkdir(similarDir);

        await expect(removeDirectory(similarDir, baseDir)).rejects.toThrow(
          'Security error: Cannot delete path outside of base directory'
        );
      });
    });
  });
});
