import { readdir, readFile, writeFile, rm, stat, cp } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import yaml from 'js-yaml';
import type {
  SkillInfo,
  SkillDetail,
  SkillMetadata,
  SkillCreateRequest,
  SkillImportRequest,
  SkillUpdateRequest,
} from '@repo/types';
import type { UserContext } from '../lib/user-context.js';
import { ensureDirectory, removeDirectory } from '../utils/directory.js';

const execAsync = promisify(exec);

/** スキルディレクトリ名 */
const SKILLS_DIR = '.claude/skills';
/** スキルファイル名 */
const SKILL_FILE = 'SKILL.md';

/**
 * スキルディレクトリのパスを取得
 */
function getSkillsDir(ctx: UserContext): string {
  return join(ctx.userHome, SKILLS_DIR);
}

/**
 * 特定スキルのディレクトリパスを取得
 */
function getSkillDir(ctx: UserContext, skillName: string): string {
  return join(getSkillsDir(ctx), skillName);
}

/**
 * スキルファイルのパスを取得
 */
function getSkillFilePath(ctx: UserContext, skillName: string): string {
  return join(getSkillDir(ctx, skillName), SKILL_FILE);
}

/**
 * YAML frontmatter + content を Markdown ファイルコンテンツとして生成
 * version は metadata.version に配置
 */
function generateSkillFileContent(
  name: string,
  version: string,
  description: string,
  content: string,
  metadata?: SkillMetadata
): string {
  // frontmatter オブジェクトを構築
  const frontmatterObj: Record<string, unknown> = {
    name,
    description,
  };

  // metadata を構築（version は常に metadata 内に配置）
  const metadataObj: Record<string, string> = {};
  if (version) {
    metadataObj.version = version;
  }
  if (metadata?.author) {
    metadataObj.author = metadata.author;
  }
  if (metadata?.source) {
    metadataObj.source = metadata.source;
  }

  // metadata に何かあれば追加
  if (Object.keys(metadataObj).length > 0) {
    frontmatterObj.metadata = metadataObj;
  }

  // js-yaml で YAML を生成（マルチライン文字列も適切に処理）
  const frontmatterYaml = yaml.dump(frontmatterObj, {
    lineWidth: -1, // 折り返しなし
    quotingType: '"',
    forceQuotes: false,
  }).trim();

  return `---
${frontmatterYaml}
---

${content}`;
}

/**
 * Markdown ファイルから frontmatter と content をパース
 */
function parseSkillFile(fileContent: string): {
  frontmatter: {
    name: string;
    version: string;
    description: string;
    metadata?: SkillMetadata;
  };
  content: string;
} | null {
  // より柔軟な正規表現（改行の数に依存しない）
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n*([\s\S]*)$/;
  const match = fileContent.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const [, frontmatter, content] = match;

  try {
    // js-yaml でパース（マルチライン文字列もサポート）
    const parsed = yaml.load(frontmatter) as Record<string, unknown> | null;

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    // 各フィールドを文字列として取得（マルチライン文字列の改行を保持）
    const name = typeof parsed.name === 'string' ? parsed.name : '';
    const description = typeof parsed.description === 'string' ? parsed.description : '';

    // メタデータをパース（version は metadata 内に配置）
    let metadata: SkillMetadata | undefined;
    let version = '';
    if (parsed.metadata && typeof parsed.metadata === 'object') {
      const meta = parsed.metadata as Record<string, unknown>;
      version = typeof meta.version === 'string' ? meta.version : '';
      metadata = {
        version: typeof meta.version === 'string' ? meta.version : undefined,
        author: typeof meta.author === 'string' ? meta.author : undefined,
        source: typeof meta.source === 'string' ? meta.source : undefined,
      };
      // すべて空の場合は undefined に
      if (!metadata.version && !metadata.author && !metadata.source) {
        metadata = undefined;
      }
    }

    return {
      frontmatter: { name, version, description, metadata },
      content: content.trim(),
    };
  } catch {
    // YAMLパースに失敗した場合はnullを返す
    return null;
  }
}

/**
 * Git URL から author（org/user）を抽出
 */
function extractAuthorFromGitUrl(url: string): string | undefined {
  // HTTPS: https://github.com/org/repo.git or https://github.com/org/repo
  const httpsMatch = url.match(/https:\/\/[^/]+\/([^/]+)\//);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  // SSH: git@github.com:org/repo.git
  const sshMatch = url.match(/git@[^:]+:([^/]+)\//);
  if (sshMatch) {
    return sshMatch[1];
  }

  return undefined;
}

/**
 * スキル一覧を取得
 */
export async function listSkills(ctx: UserContext): Promise<SkillInfo[]> {
  const skillsDir = getSkillsDir(ctx);

  try {
    await ensureDirectory(skillsDir);
    const entries = await readdir(skillsDir, { withFileTypes: true });

    const skills: SkillInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillFilePath = join(skillsDir, entry.name, SKILL_FILE);

      try {
        const stats = await stat(skillFilePath);
        const content = await readFile(skillFilePath, 'utf-8');
        const parsed = parseSkillFile(content);

        if (!parsed) continue;

        skills.push({
          name: parsed.frontmatter.name || entry.name,
          version: parsed.frontmatter.version,
          description: parsed.frontmatter.description,
          file_path: `${entry.name}/${SKILL_FILE}`,
          metadata: parsed.frontmatter.metadata,
          created_at: stats.birthtime.toISOString(),
          updated_at: stats.mtime.toISOString(),
        });
      } catch {
        // SKILL.md が存在しないディレクトリはスキップ
        continue;
      }
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    // ディレクトリが存在しない場合は空配列を返す
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * スキル詳細を取得
 */
export async function getSkill(
  ctx: UserContext,
  skillName: string
): Promise<SkillDetail | null> {
  const skillFilePath = getSkillFilePath(ctx, skillName);

  try {
    const stats = await stat(skillFilePath);
    const fileContent = await readFile(skillFilePath, 'utf-8');
    const parsed = parseSkillFile(fileContent);

    if (!parsed) return null;

    return {
      name: parsed.frontmatter.name || skillName,
      version: parsed.frontmatter.version,
      description: parsed.frontmatter.description,
      file_path: `${skillName}/${SKILL_FILE}`,
      metadata: parsed.frontmatter.metadata,
      content: parsed.content,
      raw_content: fileContent,
      created_at: stats.birthtime.toISOString(),
      updated_at: stats.mtime.toISOString(),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * スキルを作成
 */
export async function createSkill(
  ctx: UserContext,
  request: SkillCreateRequest
): Promise<SkillInfo> {
  const { name, version, description, content } = request;
  const skillDir = getSkillDir(ctx, name);
  const skillFilePath = getSkillFilePath(ctx, name);

  // ディレクトリを確保
  await ensureDirectory(skillDir);

  // 既存チェック
  try {
    await stat(skillFilePath);
    throw new Error(`Skill '${name}' already exists`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  // ファイル作成
  const fileContent = generateSkillFileContent(name, version, description, content);
  await writeFile(skillFilePath, fileContent, 'utf-8');

  const stats = await stat(skillFilePath);

  return {
    name,
    version,
    description,
    file_path: `${name}/${SKILL_FILE}`,
    created_at: stats.birthtime.toISOString(),
    updated_at: stats.mtime.toISOString(),
  };
}

/**
 * Git リポジトリからスキルをインポート
 */
export async function importSkillsFromGit(
  ctx: UserContext,
  request: SkillImportRequest
): Promise<SkillInfo[]> {
  const { repository_url, path: importPath, branch } = request;
  const skillsDir = getSkillsDir(ctx);

  // 一時ディレクトリを作成
  const tempDir = join(tmpdir(), `skill-import-${randomUUID()}`);

  // metadata を抽出
  const author = extractAuthorFromGitUrl(repository_url);
  const importMetadata: SkillMetadata = {
    author,
    source: repository_url,
  };

  try {
    // 1. git clone（指定ブランチ、shallow clone）
    await execAsync(
      `git clone --depth 1 --branch ${branch} "${repository_url}" "${tempDir}"`,
      { timeout: 60000 } // 60秒タイムアウト
    );

    // 2. インポート対象パスの確認
    const sourcePath = join(tempDir, importPath);
    const sourceStats = await stat(sourcePath);

    await ensureDirectory(skillsDir);

    const importedSkills: SkillInfo[] = [];

    if (sourceStats.isDirectory()) {
      // ディレクトリの場合: スキルディレクトリとしてコピー
      const skillName = basename(importPath);
      const destDir = join(skillsDir, skillName);

      // ディレクトリごとコピー
      await cp(sourcePath, destDir, { recursive: true, force: true });

      // SKILL.md を読み取り・metadata を追加して書き戻し
      const skillFilePath = join(destDir, SKILL_FILE);
      try {
        const content = await readFile(skillFilePath, 'utf-8');
        const parsed = parseSkillFile(content);

        if (parsed) {
          // 既存の metadata とマージ（インポート情報で上書き）
          const mergedMetadata: SkillMetadata = {
            ...parsed.frontmatter.metadata,
            ...importMetadata,
          };

          // metadata を追加してファイルを書き戻し
          const newFileContent = generateSkillFileContent(
            parsed.frontmatter.name || skillName,
            parsed.frontmatter.version,
            parsed.frontmatter.description,
            parsed.content,
            mergedMetadata
          );
          await writeFile(skillFilePath, newFileContent, 'utf-8');

          const stats = await stat(skillFilePath);

          importedSkills.push({
            name: parsed.frontmatter.name || skillName,
            version: parsed.frontmatter.version,
            description: parsed.frontmatter.description,
            file_path: `${skillName}/${SKILL_FILE}`,
            metadata: mergedMetadata,
            created_at: stats.birthtime.toISOString(),
            updated_at: stats.mtime.toISOString(),
          });
        }
      } catch {
        // SKILL.md が存在しない場合は無視
      }
    } else if (sourceStats.isFile() && basename(importPath) === SKILL_FILE) {
      // 単一のSKILL.mdファイルの場合
      // 親ディレクトリ名をスキル名として使用
      const parentDirName = basename(join(importPath, '..'));
      const skillDir = join(skillsDir, parentDirName);

      await ensureDirectory(skillDir);
      const destFile = join(skillDir, SKILL_FILE);
      await cp(sourcePath, destFile, { force: true });

      const content = await readFile(destFile, 'utf-8');
      const parsed = parseSkillFile(content);

      if (parsed) {
        // 既存の metadata とマージ（インポート情報で上書き）
        const mergedMetadata: SkillMetadata = {
          ...parsed.frontmatter.metadata,
          ...importMetadata,
        };

        // metadata を追加してファイルを書き戻し
        const newFileContent = generateSkillFileContent(
          parsed.frontmatter.name || parentDirName,
          parsed.frontmatter.version,
          parsed.frontmatter.description,
          parsed.content,
          mergedMetadata
        );
        await writeFile(destFile, newFileContent, 'utf-8');

        const stats = await stat(destFile);

        importedSkills.push({
          name: parsed.frontmatter.name || parentDirName,
          version: parsed.frontmatter.version,
          description: parsed.frontmatter.description,
          file_path: `${parentDirName}/${SKILL_FILE}`,
          metadata: mergedMetadata,
          created_at: stats.birthtime.toISOString(),
          updated_at: stats.mtime.toISOString(),
        });
      }
    }

    return importedSkills;
  } finally {
    // 3. 一時ディレクトリを削除
    await removeDirectory(tempDir);
  }
}

/**
 * スキルを削除
 */
export async function deleteSkill(ctx: UserContext, skillName: string): Promise<boolean> {
  const skillDir = getSkillDir(ctx, skillName);

  try {
    await stat(skillDir);
    await rm(skillDir, { recursive: true });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * スキルを更新
 */
export async function updateSkill(
  ctx: UserContext,
  skillName: string,
  request: SkillUpdateRequest
): Promise<SkillInfo | null> {
  const skillFilePath = getSkillFilePath(ctx, skillName);

  try {
    // 既存スキルが存在するか確認
    try {
      await stat(skillFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    // raw_content をそのまま保存
    await writeFile(skillFilePath, request.raw_content, 'utf-8');

    // 保存後にパースして情報を取得
    const parsed = parseSkillFile(request.raw_content);
    const stats = await stat(skillFilePath);

    if (!parsed) {
      // パースに失敗しても保存は成功しているので、基本情報だけ返す
      return {
        name: skillName,
        version: '',
        description: '',
        file_path: `${skillName}/${SKILL_FILE}`,
        created_at: stats.birthtime.toISOString(),
        updated_at: stats.mtime.toISOString(),
      };
    }

    return {
      name: parsed.frontmatter.name || skillName,
      version: parsed.frontmatter.version,
      description: parsed.frontmatter.description,
      file_path: `${skillName}/${SKILL_FILE}`,
      metadata: parsed.frontmatter.metadata,
      created_at: stats.birthtime.toISOString(),
      updated_at: stats.mtime.toISOString(),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}
