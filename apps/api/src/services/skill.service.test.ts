import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { __testing } from './skill.service.js';

const {
  parseSkillFile,
  generateSkillFileContent,
  extractAuthorFromGitUrl,
  validateBranchName,
  validateSkillName,
  getWorkspaceSkillsPath,
  copySkillFromDir,
} = __testing;

describe('skill.service', () => {
  describe('parseSkillFile', () => {
    it('should parse valid YAML frontmatter with all fields', () => {
      const content = `---
name: my-skill
description: A test skill
metadata:
  version: "1.0.0"
  author: test-author
  source: https://github.com/test/repo
---

This is the skill content.`;

      const result = parseSkillFile(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.name).toBe('my-skill');
      expect(result?.frontmatter.description).toBe('A test skill');
      const metadata = result?.frontmatter.metadata as Record<string, unknown> | undefined;
      expect(metadata?.version).toBe('1.0.0');
      expect(metadata?.author).toBe('test-author');
      expect(metadata?.source).toBe('https://github.com/test/repo');
      expect(result?.content).toBe('This is the skill content.');
    });

    it('should parse frontmatter without metadata', () => {
      const content = `---
name: simple-skill
description: Simple description
---

Content here.`;

      const result = parseSkillFile(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.name).toBe('simple-skill');
      expect(result?.frontmatter.description).toBe('Simple description');
      expect(result?.version).toBe(''); // version is extracted from metadata, so empty when no metadata
      expect(result?.frontmatter.metadata).toBeUndefined();
    });

    it('should return null for content without frontmatter', () => {
      const content = 'Just some regular content without frontmatter.';

      const result = parseSkillFile(content);

      expect(result).toBeNull();
    });

    it('should return null for invalid YAML', () => {
      const content = `---
name: [invalid yaml
description: missing bracket
---

Content`;

      const result = parseSkillFile(content);

      expect(result).toBeNull();
    });

    it('should handle multiline description', () => {
      const content = `---
name: multi-line
description: |
  This is a
  multiline description
---

Content`;

      const result = parseSkillFile(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.description).toContain('This is a');
      expect(result?.frontmatter.description).toContain('multiline description');
    });

    it('should handle empty content after frontmatter', () => {
      const content = `---
name: empty-content
description: Test
---
`;

      const result = parseSkillFile(content);

      expect(result).not.toBeNull();
      expect(result?.content).toBe('');
    });

    it('should handle Windows-style line endings (CRLF)', () => {
      const content = '---\r\nname: windows-skill\r\ndescription: Test\r\n---\r\n\r\nContent';

      const result = parseSkillFile(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.name).toBe('windows-skill');
    });
  });

  describe('generateSkillFileContent', () => {
    it('should generate valid skill file with all fields', () => {
      const result = generateSkillFileContent(
        {
          name: 'test-skill',
          description: 'Test description',
          metadata: {
            version: '1.0.0',
            author: 'test-author',
            source: 'https://github.com/test/repo',
          },
        },
        'Skill content here'
      );

      expect(result).toContain('---');
      expect(result).toContain('name: test-skill');
      expect(result).toContain('description: Test description');
      expect(result).toContain('version: 1.0.0');
      expect(result).toContain('author: test-author');
      expect(result).toContain('source: https://github.com/test/repo');
      expect(result).toContain('Skill content here');
    });

    it('should generate file without metadata when not provided', () => {
      const result = generateSkillFileContent(
        { name: 'simple-skill', description: 'Simple description' },
        'Content'
      );

      expect(result).toContain('name: simple-skill');
      expect(result).toContain('description: Simple description');
      expect(result).not.toContain('metadata:');
      expect(result).toContain('Content');
    });

    it('should roundtrip through parse and generate', () => {
      const original = generateSkillFileContent(
        {
          name: 'roundtrip-skill',
          description: 'Roundtrip test',
          metadata: { version: '2.0.0', author: 'author', source: 'https://example.com' },
        },
        'Test content'
      );

      const parsed = parseSkillFile(original);

      expect(parsed).not.toBeNull();
      expect(parsed?.frontmatter.name).toBe('roundtrip-skill');
      const metadata = parsed?.frontmatter.metadata as Record<string, unknown> | undefined;
      expect(metadata?.version).toBe('2.0.0');
      expect(parsed?.frontmatter.description).toBe('Roundtrip test');
      expect(parsed?.content).toBe('Test content');
    });
  });

  describe('extractAuthorFromGitUrl', () => {
    it('should extract author from HTTPS GitHub URL', () => {
      const result = extractAuthorFromGitUrl('https://github.com/anthropic/skills.git');

      expect(result).toBe('anthropic');
    });

    it('should extract author from HTTPS GitHub URL without .git', () => {
      const result = extractAuthorFromGitUrl('https://github.com/anthropic/skills');

      expect(result).toBe('anthropic');
    });

    it('should extract author from SSH GitHub URL', () => {
      const result = extractAuthorFromGitUrl('git@github.com:anthropic/skills.git');

      expect(result).toBe('anthropic');
    });

    it('should extract author from GitLab URL', () => {
      const result = extractAuthorFromGitUrl('https://gitlab.com/myorg/myrepo.git');

      expect(result).toBe('myorg');
    });

    it('should return undefined for invalid URL', () => {
      const result = extractAuthorFromGitUrl('not-a-url');

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const result = extractAuthorFromGitUrl('');

      expect(result).toBeUndefined();
    });
  });

  describe('validateBranchName', () => {
    it('should accept valid branch names', () => {
      expect(() => validateBranchName('main')).not.toThrow();
      expect(() => validateBranchName('develop')).not.toThrow();
      expect(() => validateBranchName('feature/new-feature')).not.toThrow();
      expect(() => validateBranchName('release-1.0.0')).not.toThrow();
      expect(() => validateBranchName('v1.2.3')).not.toThrow();
    });

    it('should reject empty branch name', () => {
      expect(() => validateBranchName('')).toThrow('must be 1-255 characters');
    });

    it('should reject branch name with consecutive dots', () => {
      expect(() => validateBranchName('feature..test')).toThrow('forbidden pattern');
    });

    it('should reject branch name ending with .lock', () => {
      expect(() => validateBranchName('branch.lock')).toThrow('forbidden pattern');
    });

    it('should reject branch name with control characters', () => {
      expect(() => validateBranchName('branch\x00name')).toThrow('control characters');
    });

    it('should reject branch name with forbidden characters', () => {
      expect(() => validateBranchName('branch~name')).toThrow('forbidden characters');
      expect(() => validateBranchName('branch^name')).toThrow('forbidden characters');
      expect(() => validateBranchName('branch:name')).toThrow('forbidden characters');
      expect(() => validateBranchName('branch?name')).toThrow('forbidden characters');
      expect(() => validateBranchName('branch*name')).toThrow('forbidden characters');
      expect(() => validateBranchName('branch[name')).toThrow('forbidden characters');
      expect(() => validateBranchName('branch]name')).toThrow('forbidden characters');
    });

    it('should reject branch name starting with dot', () => {
      expect(() => validateBranchName('.hidden')).toThrow('invalid characters');
    });

    it('should reject branch name with backslash', () => {
      // バックスラッシュは有効文字パターンで先に弾かれる
      expect(() => validateBranchName('branch\\name')).toThrow('invalid characters');
    });

    it('should reject very long branch name', () => {
      const longName = 'a'.repeat(256);
      expect(() => validateBranchName(longName)).toThrow('must be 1-255 characters');
    });
  });

  describe('validateSkillName', () => {
    it('should accept valid skill names', () => {
      expect(() => validateSkillName('my-skill')).not.toThrow();
      expect(() => validateSkillName('skill_v2')).not.toThrow();
      expect(() => validateSkillName('SimpleSkill')).not.toThrow();
      expect(() => validateSkillName('skill123')).not.toThrow();
    });

    it('should reject empty skill name', () => {
      expect(() => validateSkillName('')).toThrow('must be 1-255 characters');
    });

    it('should reject "." as skill name', () => {
      expect(() => validateSkillName('.')).toThrow('"." and ".." are not allowed');
    });

    it('should reject ".." as skill name', () => {
      expect(() => validateSkillName('..')).toThrow('"." and ".." are not allowed');
    });

    it('should reject skill name with forward slash', () => {
      expect(() => validateSkillName('skill/name')).toThrow('path separators are not allowed');
    });

    it('should reject skill name with backslash', () => {
      expect(() => validateSkillName('skill\\name')).toThrow('path separators are not allowed');
    });

    it('should reject skill name with null byte', () => {
      expect(() => validateSkillName('skill\x00name')).toThrow('null bytes are not allowed');
    });

    it('should reject skill name with leading whitespace', () => {
      expect(() => validateSkillName(' skill')).toThrow('leading/trailing whitespace');
    });

    it('should reject skill name with trailing whitespace', () => {
      expect(() => validateSkillName('skill ')).toThrow('leading/trailing whitespace');
    });

    it('should reject very long skill name', () => {
      const longName = 'a'.repeat(256);
      expect(() => validateSkillName(longName)).toThrow('must be 1-255 characters');
    });
  });

  describe('getWorkspaceSkillsPath', () => {
    it('should generate correct Workspace path for user', () => {
      const result = getWorkspaceSkillsPath('test-user');

      expect(result).toBe('/Workspace/Users/test-user/.assistant/skills');
    });

    it('should handle email-style username', () => {
      const result = getWorkspaceSkillsPath('user@example.com');

      expect(result).toBe('/Workspace/Users/user@example.com/.assistant/skills');
    });

    it('should handle username with special characters', () => {
      const result = getWorkspaceSkillsPath('user.name-123');

      expect(result).toBe('/Workspace/Users/user.name-123/.assistant/skills');
    });
  });

  describe('copySkillFromDir', () => {
    let tempDir: string;
    let skillsDir: string;

    const validSkillContent = `---
name: test-skill
description: A test skill
metadata:
  version: "1.0.0"
---

# Test Skill

This is a test skill content.
`;

    const importMetadata = {
      source: 'https://github.com/example/repo',
    };

    beforeEach(async () => {
      // テスト用の一時ディレクトリを作成
      const baseTemp = tmpdir();
      tempDir = join(baseTemp, `test-import-${randomUUID()}`);
      skillsDir = join(baseTemp, `test-skills-${randomUUID()}`);
      await mkdir(tempDir, { recursive: true });
      await mkdir(skillsDir, { recursive: true });
    });

    afterEach(async () => {
      // クリーンアップ
      await rm(tempDir, { recursive: true, force: true });
      await rm(skillsDir, { recursive: true, force: true });
    });

    describe('正常系', () => {
      it('相対パス (my-skill) でのインポートが成功すること', async () => {
        // スキルディレクトリを作成
        const skillDir = join(tempDir, 'my-skill');
        await mkdir(skillDir, { recursive: true });
        await writeFile(join(skillDir, 'SKILL.md'), validSkillContent);

        const result = await copySkillFromDir(skillsDir, tempDir, 'my-skill', importMetadata);

        expect(result).not.toBeNull();
        expect(result!.name).toBe('test-skill');
        expect(result!.version).toBe('1.0.0');
        expect(result!.file_path).toBe('my-skill/SKILL.md');
        expect(result!.metadata?.source).toBe('https://github.com/example/repo');
      });

      it('ネストされたディレクトリパス (skills/my-skill) でのインポートが成功すること', async () => {
        // ネストされたスキルディレクトリを作成
        const nestedSkillDir = join(tempDir, 'skills', 'my-skill');
        await mkdir(nestedSkillDir, { recursive: true });
        await writeFile(join(nestedSkillDir, 'SKILL.md'), validSkillContent);

        const result = await copySkillFromDir(
          skillsDir,
          tempDir,
          'skills/my-skill',
          importMetadata
        );

        expect(result).not.toBeNull();
        expect(result!.name).toBe('test-skill');
        expect(result!.file_path).toBe('my-skill/SKILL.md');
      });

      it('存在しないパスの場合は null を返すこと', async () => {
        const result = await copySkillFromDir(
          skillsDir,
          tempDir,
          'non-existent-skill',
          importMetadata
        );

        expect(result).toBeNull();
      });
    });

    describe('異常系（セキュリティ）', () => {
      it('パストラバーサル攻撃パターン (../../../etc/passwd) でエラーが発生すること', async () => {
        await expect(
          copySkillFromDir(skillsDir, tempDir, '../../../etc/passwd', importMetadata)
        ).rejects.toThrow('Security error');
      });

      it('パストラバーサル攻撃パターン (skill/../../../etc/passwd) でエラーが発生すること', async () => {
        // スキルディレクトリを作成（存在するパスを経由）
        const skillDir = join(tempDir, 'skill');
        await mkdir(skillDir, { recursive: true });

        await expect(
          copySkillFromDir(skillsDir, tempDir, 'skill/../../../etc/passwd', importMetadata)
        ).rejects.toThrow('Security error');
      });

      it('絶対パス (/etc/passwd) でエラーが発生すること', async () => {
        await expect(
          copySkillFromDir(skillsDir, tempDir, '/etc/passwd', importMetadata)
        ).rejects.toThrow('Security error');
      });

      it('絶対パス (/tmp/malicious) でエラーが発生すること', async () => {
        await expect(
          copySkillFromDir(skillsDir, tempDir, '/tmp/malicious', importMetadata)
        ).rejects.toThrow('Security error');
      });
    });
  });
});
