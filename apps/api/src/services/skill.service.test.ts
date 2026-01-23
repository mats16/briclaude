import { describe, it, expect } from 'vitest';
import { __testing } from './skill.service.js';

const {
  parseSkillFile,
  generateSkillFileContent,
  extractAuthorFromGitUrl,
  validateBranchName,
  validatePathWithinBase,
  validateSkillName,
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
      expect(result?.frontmatter.version).toBe('');
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

  describe('validatePathWithinBase', () => {
    it('should accept path within base directory', () => {
      const result = validatePathWithinBase('/base/dir', 'subdir/file.txt');

      expect(result).toBe('/base/dir/subdir/file.txt');
    });

    it('should reject path traversal with ../', () => {
      expect(() => validatePathWithinBase('/base/dir', '../etc/passwd')).toThrow(
        'Path traversal detected'
      );
    });

    it('should reject absolute path outside base', () => {
      expect(() => validatePathWithinBase('/base/dir', '/etc/passwd')).toThrow(
        'Path traversal detected'
      );
    });

    it('should accept deeply nested path', () => {
      const result = validatePathWithinBase('/base', 'a/b/c/d/e/file.txt');

      expect(result).toBe('/base/a/b/c/d/e/file.txt');
    });

    it('should normalize path with redundant separators', () => {
      const result = validatePathWithinBase('/base/dir', 'subdir//file.txt');

      expect(result).toBe('/base/dir/subdir/file.txt');
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
});
