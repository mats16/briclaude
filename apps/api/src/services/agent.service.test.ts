import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { __testing } from './agent.service.js';

const {
  parseAgentFile,
  generateAgentFileContent,
  extractAuthorFromGitUrl,
  validateBranchName,
  validateAgentName,
  getWorkspaceAgentsPath,
  copyAgentFromDir,
} = __testing;

describe('agent.service', () => {
  describe('parseAgentFile', () => {
    it('should parse valid YAML frontmatter with all fields', () => {
      const content = `---
name: my-agent
description: A test agent
tools: Read, Write, Bash
metadata:
  version: "1.0.0"
  author: test-author
  source: https://github.com/test/repo
---

This is the agent content.`;

      const result = parseAgentFile(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.name).toBe('my-agent');
      expect(result?.frontmatter.description).toBe('A test agent');
      expect(result?.tools).toBe('Read, Write, Bash');
      const metadata = result?.frontmatter.metadata as Record<string, unknown> | undefined;
      expect(metadata?.version).toBe('1.0.0');
      expect(metadata?.author).toBe('test-author');
      expect(metadata?.source).toBe('https://github.com/test/repo');
      expect(result?.content).toBe('This is the agent content.');
    });

    it('should parse frontmatter without metadata', () => {
      const content = `---
name: simple-agent
description: Simple description
---

Content here.`;

      const result = parseAgentFile(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.name).toBe('simple-agent');
      expect(result?.frontmatter.description).toBe('Simple description');
      expect(result?.version).toBe(''); // version is extracted from metadata, so empty when no metadata
      expect(result?.frontmatter.metadata).toBeUndefined();
    });

    it('should parse frontmatter with tools field', () => {
      const content = `---
name: tool-agent
description: Agent with tools
tools: Task, Read, Write
metadata:
  version: "1.0.0"
---

Agent content.`;

      const result = parseAgentFile(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.name).toBe('tool-agent');
      expect(result?.tools).toBe('Task, Read, Write');
      expect(result?.frontmatter.tools).toBe('Task, Read, Write');
    });

    it('should return null for content without frontmatter', () => {
      const content = 'Just some regular content without frontmatter.';

      const result = parseAgentFile(content);

      expect(result).toBeNull();
    });

    it('should return null for invalid YAML', () => {
      const content = `---
name: [invalid yaml
description: missing bracket
---

Content`;

      const result = parseAgentFile(content);

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

      const result = parseAgentFile(content);

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

      const result = parseAgentFile(content);

      expect(result).not.toBeNull();
      expect(result?.content).toBe('');
    });

    it('should handle Windows-style line endings (CRLF)', () => {
      const content = '---\r\nname: windows-agent\r\ndescription: Test\r\n---\r\n\r\nContent';

      const result = parseAgentFile(content);

      expect(result).not.toBeNull();
      expect(result?.frontmatter.name).toBe('windows-agent');
    });
  });

  describe('generateAgentFileContent', () => {
    it('should generate valid agent file with all fields', () => {
      const result = generateAgentFileContent(
        {
          name: 'test-agent',
          description: 'Test description',
          tools: 'Read, Write, Bash',
          metadata: {
            version: '1.0.0',
            author: 'test-author',
            source: 'https://github.com/test/repo',
          },
        },
        'Agent content here'
      );

      expect(result).toContain('---');
      expect(result).toContain('name: "test-agent"');
      expect(result).toContain('description: "Test description"');
      expect(result).toContain('tools: "Read, Write, Bash"');
      expect(result).toContain('version: "1.0.0"');
      expect(result).toContain('author: "test-author"');
      expect(result).toContain('source: "https://github.com/test/repo"');
      expect(result).toContain('Agent content here');
    });

    it('should generate file without metadata when not provided', () => {
      const result = generateAgentFileContent(
        { name: 'simple-agent', description: 'Simple description' },
        'Content'
      );

      expect(result).toContain('name: "simple-agent"');
      expect(result).toContain('description: "Simple description"');
      expect(result).not.toContain('metadata:');
      expect(result).toContain('Content');
    });

    it('should generate file without tools when not provided', () => {
      const result = generateAgentFileContent(
        {
          name: 'no-tools-agent',
          description: 'Agent without tools',
          metadata: { version: '1.0.0' },
        },
        'Content'
      );

      expect(result).toContain('name: "no-tools-agent"');
      expect(result).not.toContain('tools:');
      expect(result).toContain('Content');
    });

    it('should roundtrip through parse and generate', () => {
      const original = generateAgentFileContent(
        {
          name: 'roundtrip-agent',
          description: 'Roundtrip test',
          tools: 'Task, Read',
          metadata: { version: '2.0.0', author: 'author', source: 'https://example.com' },
        },
        'Test content'
      );

      const parsed = parseAgentFile(original);

      expect(parsed).not.toBeNull();
      expect(parsed?.frontmatter.name).toBe('roundtrip-agent');
      expect(parsed?.tools).toBe('Task, Read');
      const metadata = parsed?.frontmatter.metadata as Record<string, unknown> | undefined;
      expect(metadata?.version).toBe('2.0.0');
      expect(parsed?.frontmatter.description).toBe('Roundtrip test');
      expect(parsed?.content).toBe('Test content');
    });
  });

  describe('extractAuthorFromGitUrl', () => {
    it('should extract author from HTTPS GitHub URL', () => {
      const result = extractAuthorFromGitUrl('https://github.com/anthropic/agents.git');

      expect(result).toBe('anthropic');
    });

    it('should extract author from HTTPS GitHub URL without .git', () => {
      const result = extractAuthorFromGitUrl('https://github.com/anthropic/agents');

      expect(result).toBe('anthropic');
    });

    it('should extract author from SSH GitHub URL', () => {
      const result = extractAuthorFromGitUrl('git@github.com:anthropic/agents.git');

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

  describe('validateAgentName', () => {
    it('should accept valid agent names', () => {
      expect(() => validateAgentName('my-agent')).not.toThrow();
      expect(() => validateAgentName('agent_v2')).not.toThrow();
      expect(() => validateAgentName('SimpleAgent')).not.toThrow();
      expect(() => validateAgentName('agent123')).not.toThrow();
    });

    it('should reject empty agent name', () => {
      expect(() => validateAgentName('')).toThrow('must be 1-255 characters');
    });

    it('should reject "." as agent name', () => {
      expect(() => validateAgentName('.')).toThrow(
        'only alphanumeric, hyphens, and underscores are allowed'
      );
    });

    it('should reject ".." as agent name', () => {
      expect(() => validateAgentName('..')).toThrow(
        'only alphanumeric, hyphens, and underscores are allowed'
      );
    });

    it('should reject agent name with forward slash', () => {
      expect(() => validateAgentName('agent/name')).toThrow(
        'only alphanumeric, hyphens, and underscores are allowed'
      );
    });

    it('should reject agent name with backslash', () => {
      expect(() => validateAgentName('agent\\name')).toThrow(
        'only alphanumeric, hyphens, and underscores are allowed'
      );
    });

    it('should reject agent name with null byte', () => {
      expect(() => validateAgentName('agent\x00name')).toThrow(
        'only alphanumeric, hyphens, and underscores are allowed'
      );
    });

    it('should reject agent name with leading whitespace', () => {
      expect(() => validateAgentName(' agent')).toThrow(
        'only alphanumeric, hyphens, and underscores are allowed'
      );
    });

    it('should reject agent name with trailing whitespace', () => {
      expect(() => validateAgentName('agent ')).toThrow(
        'only alphanumeric, hyphens, and underscores are allowed'
      );
    });

    it('should reject very long agent name', () => {
      const longName = 'a'.repeat(256);
      expect(() => validateAgentName(longName)).toThrow('must be 1-255 characters');
    });
  });

  describe('getWorkspaceAgentsPath', () => {
    it('should generate correct Workspace path for user', () => {
      const result = getWorkspaceAgentsPath('test-user');

      expect(result).toBe('/Workspace/Users/test-user/.assistant/agents');
    });

    it('should handle email-style username', () => {
      const result = getWorkspaceAgentsPath('user@example.com');

      expect(result).toBe('/Workspace/Users/user@example.com/.assistant/agents');
    });

    it('should handle username with special characters', () => {
      const result = getWorkspaceAgentsPath('user.name-123');

      expect(result).toBe('/Workspace/Users/user.name-123/.assistant/agents');
    });
  });

  describe('copyAgentFromDir', () => {
    let tempDir: string;
    let agentsDir: string;

    const validAgentContent = `---
name: test-agent
description: A test agent
tools: Read, Write, Bash
metadata:
  version: "1.0.0"
---

# Test Agent

This is a test agent content.
`;

    const importMetadata = {
      source: 'https://github.com/example/repo',
    };

    beforeEach(async () => {
      // テスト用の一時ディレクトリを作成
      const baseTemp = tmpdir();
      tempDir = join(baseTemp, `test-import-${randomUUID()}`);
      agentsDir = join(baseTemp, `test-agents-${randomUUID()}`);
      await mkdir(tempDir, { recursive: true });
      await mkdir(agentsDir, { recursive: true });
    });

    afterEach(async () => {
      // クリーンアップ
      await rm(tempDir, { recursive: true, force: true });
      await rm(agentsDir, { recursive: true, force: true });
    });

    describe('正常系', () => {
      it('相対パス (my-agent.md) でのインポートが成功すること', async () => {
        // エージェントファイルを作成
        await writeFile(join(tempDir, 'my-agent.md'), validAgentContent);

        const result = await copyAgentFromDir(agentsDir, tempDir, 'my-agent.md', importMetadata);

        expect(result).not.toBeNull();
        expect(result!.name).toBe('test-agent');
        expect(result!.version).toBe('1.0.0');
        expect(result!.file_path).toBe('my-agent.md');
        expect(result!.metadata?.source).toBe('https://github.com/example/repo');
      });

      it('ネストされたディレクトリパス (agents/my-agent.md) でのインポートが成功すること', async () => {
        // ネストされたエージェントファイルを作成
        const nestedDir = join(tempDir, 'agents');
        await mkdir(nestedDir, { recursive: true });
        await writeFile(join(nestedDir, 'my-agent.md'), validAgentContent);

        const result = await copyAgentFromDir(
          agentsDir,
          tempDir,
          'agents/my-agent.md',
          importMetadata
        );

        expect(result).not.toBeNull();
        expect(result!.name).toBe('test-agent');
        expect(result!.file_path).toBe('my-agent.md');
      });

      it('存在しないパスの場合は null を返すこと', async () => {
        const result = await copyAgentFromDir(
          agentsDir,
          tempDir,
          'non-existent-agent.md',
          importMetadata
        );

        expect(result).toBeNull();
      });
    });

    describe('異常系（セキュリティ）', () => {
      it('パストラバーサル攻撃パターン (../../../etc/passwd) でエラーが発生すること', async () => {
        await expect(
          copyAgentFromDir(agentsDir, tempDir, '../../../etc/passwd', importMetadata)
        ).rejects.toThrow('Security error');
      });

      it('パストラバーサル攻撃パターン (agent/../../../etc/passwd) でエラーが発生すること', async () => {
        // エージェントディレクトリを作成（存在するパスを経由）
        const agentDir = join(tempDir, 'agent');
        await mkdir(agentDir, { recursive: true });

        await expect(
          copyAgentFromDir(agentsDir, tempDir, 'agent/../../../etc/passwd', importMetadata)
        ).rejects.toThrow('Security error');
      });

      it('絶対パス (/etc/passwd) でエラーが発生すること', async () => {
        await expect(
          copyAgentFromDir(agentsDir, tempDir, '/etc/passwd', importMetadata)
        ).rejects.toThrow('Security error');
      });

      it('絶対パス (/tmp/malicious) でエラーが発生すること', async () => {
        await expect(
          copyAgentFromDir(agentsDir, tempDir, '/tmp/malicious', importMetadata)
        ).rejects.toThrow('Security error');
      });
    });
  });
});
