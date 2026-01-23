// apps/api/src/utils/path-validation.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, symlink, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validatePathWithinBase } from './path-validation.js';

describe('validatePathWithinBase', () => {
  let testBaseDir: string;

  beforeEach(async () => {
    // テスト用の一時ディレクトリを作成
    testBaseDir = join(tmpdir(), `test-path-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

  describe('正常系', () => {
    it('baseDir 配下のパスが検証を通過する', async () => {
      const targetDir = join(testBaseDir, 'subdir');
      await mkdir(targetDir);

      const result = await validatePathWithinBase(targetDir, testBaseDir);

      // realpath で正規化されたパスが返される
      const expected = await realpath(targetDir);
      expect(result).toBe(expected);
    });

    it('baseDir と同じパスが検証を通過する', async () => {
      const result = await validatePathWithinBase(testBaseDir, testBaseDir);

      // realpath で正規化されたパスが返される
      const expected = await realpath(testBaseDir);
      expect(result).toBe(expected);
    });

    it('存在しないパスが検証を通過する（resolve にフォールバック）', async () => {
      const targetDir = join(testBaseDir, 'non-existent');

      const result = await validatePathWithinBase(targetDir, testBaseDir);

      // baseDir は realpath で正規化されるので、その配下にあることを確認
      const normalizedBase = await realpath(testBaseDir);
      expect(result.startsWith(normalizedBase)).toBe(true);
    });

    it('ネストされたパスが検証を通過する', async () => {
      const nestedDir = join(testBaseDir, 'level1', 'level2', 'level3');
      await mkdir(nestedDir, { recursive: true });

      const result = await validatePathWithinBase(nestedDir, testBaseDir);

      // realpath で正規化されたパスが返される
      const expected = await realpath(nestedDir);
      expect(result).toBe(expected);
    });

    it('シンボリックリンクが正しく解決される（baseDir 配下を指す場合）', async () => {
      const targetDir = join(testBaseDir, 'target');
      const linkPath = join(testBaseDir, 'link');
      await mkdir(targetDir);
      await symlink(targetDir, linkPath);

      const result = await validatePathWithinBase(linkPath, testBaseDir);

      // シンボリックリンクが解決されて実際のパスになる
      const expected = await realpath(targetDir);
      expect(result).toBe(expected);
    });
  });

  describe('異常系: パストラバーサル攻撃', () => {
    it('baseDir 外のパスでエラーが発生する', async () => {
      const outsideDir = join(tmpdir(), 'outside-dir');
      await mkdir(outsideDir, { recursive: true });

      try {
        await expect(validatePathWithinBase(outsideDir, testBaseDir)).rejects.toThrow(
          'Security error: Cannot access path outside of base directory'
        );
      } finally {
        await rm(outsideDir, { recursive: true, force: true });
      }
    });

    it('相対パスによるパストラバーサル攻撃でエラーが発生する', async () => {
      const maliciousPath = join(testBaseDir, '..', '..', 'etc', 'passwd');

      await expect(validatePathWithinBase(maliciousPath, testBaseDir)).rejects.toThrow(
        'Security error'
      );
    });

    it('類似パス攻撃でエラーが発生する（/base vs /base-other）', async () => {
      const baseDir = join(testBaseDir, 'base');
      const similarDir = join(testBaseDir, 'base-other');
      await mkdir(baseDir, { recursive: true });
      await mkdir(similarDir, { recursive: true });

      await expect(validatePathWithinBase(similarDir, baseDir)).rejects.toThrow(
        'Security error: Cannot access path outside of base directory'
      );
    });

    it('絶対パスによる外部アクセスでエラーが発生する', async () => {
      await expect(validatePathWithinBase('/etc/passwd', testBaseDir)).rejects.toThrow(
        'Security error'
      );
    });

    it('シンボリックリンクが baseDir 外を指す場合にエラーが発生する', async () => {
      const outsideDir = join(tmpdir(), 'outside-target');
      const linkPath = join(testBaseDir, 'malicious-link');
      await mkdir(outsideDir, { recursive: true });

      try {
        await symlink(outsideDir, linkPath);

        await expect(validatePathWithinBase(linkPath, testBaseDir)).rejects.toThrow(
          'Security error'
        );
      } finally {
        await rm(outsideDir, { recursive: true, force: true });
      }
    });
  });

  describe('エッジケース', () => {
    it('baseDir が realpath で解決できない場合はエラー', async () => {
      const nonExistentBase = join(testBaseDir, 'non-existent-base');

      await expect(
        validatePathWithinBase(join(nonExistentBase, 'target'), nonExistentBase)
      ).rejects.toThrow();
    });

    it('空文字列パスでエラーが発生する', async () => {
      await expect(validatePathWithinBase('', testBaseDir)).rejects.toThrow();
    });
  });
});
