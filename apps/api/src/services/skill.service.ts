import { readdir, readFile, writeFile, rm, stat, cp } from 'node:fs/promises';
import { join, basename, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
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
  SkillBackupResponse,
  SkillRestoreResponse,
} from '@repo/types';
import type { UserContext } from '../lib/user-context.js';
import type { AuthProvider } from '../lib/databricks-auth.js';
import { ensureDirectory, removeDirectory } from '../utils/directory.js';
import { validatePathWithinBase } from '../utils/path-validation.js';

/**
 * サービス層用のシンプルなロガー
 * 将来的にはDI経由でFastifyのロガーを注入することを推奨
 */
const logger = {
  warn: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[skill.service] ${message}`, context ?? '');
    }
  },
  error: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[skill.service] ${message}`, context ?? '');
    }
  },
};

/** スキルディレクトリ名 */
const SKILLS_DIR = '.claude/skills';
/** スキルファイル名 */
const SKILL_FILE = 'SKILL.md';

/**
 * Git ブランチ名のバリデーション（コマンドインジェクション対策）
 * 有効な Git ブランチ名の文字のみを許可
 */
function validateBranchName(branch: string): void {
  // Git ブランチ名に許可される文字: 英数字、ハイフン、アンダースコア、スラッシュ、ドット
  // 先頭・末尾のドット、連続ドット、特殊シーケンスを禁止
  const validBranchPattern = /^[a-zA-Z0-9]([a-zA-Z0-9._/-]*[a-zA-Z0-9])?$/;
  const invalidPatterns = [
    /\.\./, // 連続ドット
    /\/\//, // 連続スラッシュ
    /@\{/, // reflog シンタックス
    /\\/, // バックスラッシュ
    /\.lock$/, // .lock で終わる名前
  ];

  // 制御文字のチェック（ESLint no-control-regex 回避のため別途チェック）
  // eslint-disable-next-line no-control-regex
  const controlCharPattern = /[\x00-\x1f\x7f]/;
  if (controlCharPattern.test(branch)) {
    throw new Error('Invalid branch name: contains control characters');
  }

  // Git で禁止されている文字のチェック
  const forbiddenCharsPattern = /[~^:?*[\]]/;
  if (forbiddenCharsPattern.test(branch)) {
    throw new Error('Invalid branch name: contains forbidden characters');
  }

  if (!branch || branch.length > 255) {
    throw new Error('Invalid branch name: must be 1-255 characters');
  }

  if (!validBranchPattern.test(branch)) {
    throw new Error('Invalid branch name: contains invalid characters');
  }

  for (const pattern of invalidPatterns) {
    if (pattern.test(branch)) {
      throw new Error('Invalid branch name: contains forbidden pattern');
    }
  }
}

/**
 * スキル名のバリデーション
 * パス区切り文字、`.`、`..` のみの名前を拒否
 */
function validateSkillName(name: string): void {
  if (!name || name.length > 255) {
    throw new Error('Invalid skill name: must be 1-255 characters');
  }

  // `.` または `..` のみの名前を拒否
  if (name === '.' || name === '..') {
    throw new Error('Invalid skill name: "." and ".." are not allowed');
  }

  // パス区切り文字を含む名前を拒否
  if (name.includes('/') || name.includes('\\')) {
    throw new Error('Invalid skill name: path separators are not allowed');
  }

  // null バイトを含む名前を拒否
  if (name.includes('\0')) {
    throw new Error('Invalid skill name: null bytes are not allowed');
  }

  // 先頭・末尾の空白を拒否
  if (name !== name.trim()) {
    throw new Error('Invalid skill name: leading/trailing whitespace is not allowed');
  }
}

/**
 * スキルディレクトリのパスを取得
 */
function getSkillsDir(ctx: UserContext): string {
  return join(ctx.userHome, SKILLS_DIR);
}

/**
 * 特定スキルのディレクトリパスを取得
 * 内部でスキル名のバリデーションを行うため、呼び出し元での重複チェックは不要
 */
function getSkillDir(ctx: UserContext, skillName: string): string {
  validateSkillName(skillName);
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
 * 元の frontmatter オブジェクトを保持し、必要な部分だけをマージ
 */
function generateSkillFileContent(frontmatter: Record<string, unknown>, content: string): string {
  // js-yaml で YAML を生成（マルチライン文字列も適切に処理）
  const frontmatterYaml = yaml
    .dump(frontmatter, {
      lineWidth: -1, // 折り返しなし
      quotingType: '"',
      forceQuotes: false,
    })
    .trim();

  return `---
${frontmatterYaml}
---

${content}`;
}

/**
 * Markdown ファイルから frontmatter と content をパース
 * 元の YAML 全体を保持する
 */
function parseSkillFile(fileContent: string): {
  frontmatter: Record<string, unknown>;
  name: string;
  version: string;
  description: string;
  metadata?: SkillMetadata;
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
      frontmatter: parsed,
      name,
      version,
      description,
      metadata,
      content: content.trim(),
    };
  } catch (error) {
    // YAMLパースに失敗した場合はnullを返す
    logger.warn('Failed to parse YAML frontmatter', {
      error: error instanceof Error ? error.message : String(error),
      frontmatterPreview: frontmatter.slice(0, 100),
    });
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
          name: parsed.name || entry.name,
          version: parsed.version,
          description: parsed.description,
          file_path: `${entry.name}/${SKILL_FILE}`,
          metadata: parsed.metadata,
          created_at: stats.birthtime.toISOString(),
          updated_at: stats.mtime.toISOString(),
        });
      } catch (error) {
        // SKILL.md が存在しないディレクトリはスキップ
        // ENOENT以外のエラーはログに記録
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn('Failed to read skill file', {
            skillDir: entry.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
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
export async function getSkill(ctx: UserContext, skillName: string): Promise<SkillDetail | null> {
  // バリデーションは getSkillFilePath -> getSkillDir 内で実行される
  const skillFilePath = getSkillFilePath(ctx, skillName);

  try {
    const stats = await stat(skillFilePath);
    const fileContent = await readFile(skillFilePath, 'utf-8');
    const parsed = parseSkillFile(fileContent);

    if (!parsed) return null;

    return {
      name: parsed.name || skillName,
      version: parsed.version,
      description: parsed.description,
      file_path: `${skillName}/${SKILL_FILE}`,
      metadata: parsed.metadata,
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
  request: SkillCreateRequest,
  authorName?: string
): Promise<SkillInfo> {
  const { name, version, description, content } = request;

  // バリデーションは getSkillDir 内で実行される
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

  // frontmatter オブジェクトを構築
  const frontmatter: Record<string, unknown> = {
    name,
    description,
  };

  // metadata を構築（author を追加）
  const metadataObj: Record<string, string> = {};
  if (version) {
    metadataObj.version = version;
  }
  if (authorName) {
    metadataObj.author = authorName;
  }

  if (Object.keys(metadataObj).length > 0) {
    frontmatter.metadata = metadataObj;
  }

  // metadata を SkillMetadata 型として構築
  const metadata: SkillMetadata | undefined =
    Object.keys(metadataObj).length > 0
      ? {
          version: version || undefined,
          author: authorName || undefined,
        }
      : undefined;

  // ファイル作成
  const fileContent = generateSkillFileContent(frontmatter, content);
  await writeFile(skillFilePath, fileContent, 'utf-8');

  const stats = await stat(skillFilePath);

  return {
    name,
    version,
    description,
    file_path: `${name}/${SKILL_FILE}`,
    metadata,
    created_at: stats.birthtime.toISOString(),
    updated_at: stats.mtime.toISOString(),
  };
}

/**
 * spawn でコマンドを実行し、Promise を返すヘルパー関数
 */
function spawnAsync(
  command: string,
  args: string[],
  options: { timeout?: number; cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false, // シェルを使わない（コマンドインジェクション防止）
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timeoutId = options.timeout
      ? setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timed out after ${options.timeout}ms`));
        }, options.timeout)
      : null;

    child.on('close', code => {
      if (timeoutId) clearTimeout(timeoutId);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
      }
    });

    child.on('error', err => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * 単一のスキルを一時ディレクトリからユーザーのスキルディレクトリにコピー
 *
 * @param skillsDir - コピー先のスキルディレクトリ（絶対パス）
 * @param tempDir - 一時ディレクトリ（絶対パス、ベースディレクトリとして使用）
 * @param importPath - インポート対象のパス（tempDir からの相対パス、例: "my-skill" または "skills/my-skill"）
 *                     絶対パスやパストラバーサル（"../"）は validatePathWithinBase でセキュリティエラーとなる
 * @param importMetadata - インポート時に付与するメタデータ
 * @returns コピーされたスキル情報、または存在しない場合は null
 */
async function copySkillFromDir(
  skillsDir: string,
  tempDir: string,
  importPath: string,
  importMetadata: SkillMetadata
): Promise<SkillInfo | null> {
  // 絶対パスを拒否（join() で無害化される前にチェック）
  if (isAbsolute(importPath)) {
    throw new Error(`Security error: Absolute import path is not allowed: ${importPath}`);
  }

  // インポート対象パスの確認（パストラバーサル対策）
  const fullImportPath = join(tempDir, importPath);
  const sourcePath = await validatePathWithinBase(fullImportPath, tempDir);

  let sourceStats;
  try {
    sourceStats = await stat(sourcePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warn('Import path not found', { importPath });
      return null;
    }
    throw error;
  }

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
        // frontmatter の metadata とインポート情報をマージ
        const frontmatter = { ...parsed.frontmatter };
        const existingMetadata =
          frontmatter.metadata && typeof frontmatter.metadata === 'object'
            ? (frontmatter.metadata as Record<string, unknown>)
            : {};
        const mergedMetadataObj = { ...existingMetadata };

        // importMetadata.source のみをマージ（author は追加しない）
        if (importMetadata.source) {
          mergedMetadataObj.source = importMetadata.source;
        }

        frontmatter.metadata = mergedMetadataObj;

        // SkillMetadata 型として構築
        const mergedMetadata: SkillMetadata = {
          version:
            typeof mergedMetadataObj.version === 'string' ? mergedMetadataObj.version : undefined,
          author:
            typeof mergedMetadataObj.author === 'string' ? mergedMetadataObj.author : undefined,
          source:
            typeof mergedMetadataObj.source === 'string' ? mergedMetadataObj.source : undefined,
        };

        // metadata を追加してファイルを書き戻し
        const newFileContent = generateSkillFileContent(frontmatter, parsed.content);
        await writeFile(skillFilePath, newFileContent, 'utf-8');

        const stats = await stat(skillFilePath);

        return {
          name: parsed.name || skillName,
          version: parsed.version,
          description: parsed.description,
          file_path: `${skillName}/${SKILL_FILE}`,
          metadata: mergedMetadata,
          created_at: stats.birthtime.toISOString(),
          updated_at: stats.mtime.toISOString(),
        };
      }
    } catch (error) {
      // SKILL.md が存在しない場合は無視
      // ENOENT以外のエラーはログに記録
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to process imported skill', {
          skillName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
      // frontmatter の metadata とインポート情報をマージ
      const frontmatter = { ...parsed.frontmatter };
      const existingMetadata =
        frontmatter.metadata && typeof frontmatter.metadata === 'object'
          ? (frontmatter.metadata as Record<string, unknown>)
          : {};
      const mergedMetadataObj = { ...existingMetadata };

      // importMetadata.source のみをマージ（author は追加しない）
      if (importMetadata.source) {
        mergedMetadataObj.source = importMetadata.source;
      }

      frontmatter.metadata = mergedMetadataObj;

      // SkillMetadata 型として構築
      const mergedMetadata: SkillMetadata = {
        version:
          typeof mergedMetadataObj.version === 'string' ? mergedMetadataObj.version : undefined,
        author: typeof mergedMetadataObj.author === 'string' ? mergedMetadataObj.author : undefined,
        source: typeof mergedMetadataObj.source === 'string' ? mergedMetadataObj.source : undefined,
      };

      // metadata を追加してファイルを書き戻し
      const newFileContent = generateSkillFileContent(frontmatter, parsed.content);
      await writeFile(destFile, newFileContent, 'utf-8');

      const stats = await stat(destFile);

      return {
        name: parsed.name || parentDirName,
        version: parsed.version,
        description: parsed.description,
        file_path: `${parentDirName}/${SKILL_FILE}`,
        metadata: mergedMetadata,
        created_at: stats.birthtime.toISOString(),
        updated_at: stats.mtime.toISOString(),
      };
    }
  }

  return null;
}

/**
 * Git リポジトリからスキルをインポート（複数パス対応、sparse-checkout で効率化）
 */
export async function importSkillsFromGit(
  ctx: UserContext,
  request: SkillImportRequest
): Promise<SkillInfo[]> {
  const { repository_url, paths, branch = 'main' } = request;
  const skillsDir = getSkillsDir(ctx);

  // ブランチ名のバリデーション（コマンドインジェクション対策）
  validateBranchName(branch);

  // 一時ディレクトリを作成
  const tempDir = join(tmpdir(), `skill-import-${randomUUID()}`);

  // metadata を構築（source のみ）
  const importMetadata: SkillMetadata = {
    source: repository_url,
  };

  try {
    // 1. git clone（blobless clone + no-checkout で最小限のメタデータのみ取得）
    // spawn を使用してコマンドインジェクションを防止
    await spawnAsync(
      'git',
      [
        'clone',
        '--filter=blob:none',
        '--no-checkout',
        '--depth',
        '1',
        '--branch',
        branch,
        repository_url,
        tempDir,
      ],
      { timeout: 60000 } // 60秒タイムアウト
    );

    // 2. sparse-checkout を設定して必要なパスのみをチェックアウト
    try {
      await spawnAsync('git', ['sparse-checkout', 'init', '--cone'], {
        cwd: tempDir,
        timeout: 10000,
      });

      // sparse-checkout set に全パスを渡す
      await spawnAsync('git', ['sparse-checkout', 'set', ...paths], {
        cwd: tempDir,
        timeout: 10000,
      });

      // 3. チェックアウト実行（必要なファイルのみダウンロード）
      await spawnAsync('git', ['checkout'], {
        cwd: tempDir,
        timeout: 60000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Git sparse-checkout failed', { paths, error: message });
      throw new Error(
        `Failed to checkout specified paths from repository. Please verify the paths exist in the repository.`
      );
    }

    await ensureDirectory(skillsDir);

    // 4. 各パスを並列でコピー
    const results = await Promise.all(
      paths.map(importPath => copySkillFromDir(skillsDir, tempDir, importPath, importMetadata))
    );

    return results.filter((skill): skill is SkillInfo => skill !== null);
  } finally {
    // 5. 一時ディレクトリを削除
    await removeDirectory(tempDir);
  }
}

/**
 * スキルを削除
 */
export async function deleteSkill(ctx: UserContext, skillName: string): Promise<boolean> {
  // バリデーションは getSkillDir 内で実行される
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
  // バリデーションは getSkillFilePath -> getSkillDir 内で実行される
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
      name: parsed.name || skillName,
      version: parsed.version,
      description: parsed.description,
      file_path: `${skillName}/${SKILL_FILE}`,
      metadata: parsed.metadata,
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
 * Workspace上のスキルパスを生成
 * /Workspace/Users/{userName}/.assistant/skills
 */
function getWorkspaceSkillsPath(userName: string): string {
  return `/Workspace/Users/${userName}/.assistant/skills`;
}

/**
 * Databricks CLI を実行するヘルパー関数
 * 認証情報を環境変数として渡す
 */
function spawnDatabricksCli(
  args: string[],
  options: {
    authProvider: AuthProvider;
    timeout?: number;
    cwd?: string;
  }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('databricks', args, {
      cwd: options.cwd,
      shell: false,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ...options.authProvider.getEnvVars(),
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timeoutMs = options.timeout ?? 120000; // デフォルト2分
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Databricks CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('close', code => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Databricks CLI failed with exit code ${code}: ${stderr}`));
      }
    });

    child.on('error', err => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * スキルを Workspace にバックアップ
 * ローカルの .claude/skills/ → /Workspace/Users/{user}/.assistant/skills/
 */
export async function backupSkillsToWorkspace(ctx: UserContext): Promise<SkillBackupResponse> {
  const localSkillsDir = getSkillsDir(ctx);
  const workspacePath = getWorkspaceSkillsPath(ctx.userName);

  // 認証情報を取得
  const authProvider = await ctx.getAuthProvider();
  if (authProvider.type !== 'pat') {
    throw new Error('PAT is required for backup operation');
  }

  // ローカルスキルディレクトリが存在するか確認
  try {
    await stat(localSkillsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        success: true,
        message: 'No skills to backup',
        workspace_path: workspacePath,
      };
    }
    throw error;
  }

  // 1. Workspace 上の既存ディレクトリを削除（エラーは無視）
  try {
    await spawnDatabricksCli(['workspace', 'delete', workspacePath, '--recursive'], {
      authProvider,
      timeout: 30000,
    });
  } catch {
    // ディレクトリが存在しない場合のエラーは無視
  }

  // 2. Workspace にインポート
  await spawnDatabricksCli(
    ['workspace', 'import-dir', localSkillsDir, workspacePath, '--overwrite'],
    {
      authProvider,
      timeout: 120000,
    }
  );

  return {
    success: true,
    message: 'Skills backed up successfully',
    workspace_path: workspacePath,
  };
}

/**
 * Workspace からスキルをリストア
 * /Workspace/Users/{user}/.assistant/skills/ → ローカルの .claude/skills/
 */
export async function restoreSkillsFromWorkspace(ctx: UserContext): Promise<SkillRestoreResponse> {
  const localSkillsDir = getSkillsDir(ctx);
  const workspacePath = getWorkspaceSkillsPath(ctx.userName);

  // 認証情報を取得
  const authProvider = await ctx.getAuthProvider();
  if (authProvider.type !== 'pat') {
    throw new Error('PAT is required for restore operation');
  }

  // 1. ローカルの既存ディレクトリを削除
  // セキュリティ: ユーザーホーム配下であることを検証
  const safeSkillsDir = await validatePathWithinBase(localSkillsDir, ctx.userHome);
  await removeDirectory(safeSkillsDir);

  // 2. ローカルディレクトリを再作成
  await ensureDirectory(localSkillsDir);

  // 3. Workspace からエクスポート
  await spawnDatabricksCli(
    ['workspace', 'export-dir', workspacePath, localSkillsDir, '--overwrite'],
    {
      authProvider,
      timeout: 120000,
    }
  );

  return {
    success: true,
    message: 'Skills restored successfully',
  };
}

// テスト用エクスポート（内部関数のユニットテスト用）
export const __testing = {
  parseSkillFile,
  generateSkillFileContent,
  extractAuthorFromGitUrl,
  validateBranchName,
  validateSkillName,
  getWorkspaceSkillsPath,
  copySkillFromDir,
};
