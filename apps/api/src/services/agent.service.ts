import { readdir, readFile, writeFile, rm, stat, cp } from 'node:fs/promises';
import { join, basename, extname, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import yaml from 'js-yaml';
import type {
  AgentInfo,
  AgentDetail,
  AgentMetadata,
  AgentCreateRequest,
  AgentImportRequest,
  AgentUpdateRequest,
  AgentBackupResponse,
  AgentRestoreResponse,
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
      console.warn(`[agent.service] ${message}`, context ?? '');
    }
  },
  error: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== 'test') {
      console.error(`[agent.service] ${message}`, context ?? '');
    }
  },
};

/** エージェントディレクトリ名 */
const AGENTS_DIR = '.claude/agents';

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
 * エージェント名のバリデーション
 * 英数字、ハイフン、アンダースコアのみを許可し、パストラバーサルや特殊文字を拒否
 */
function validateAgentName(name: string): void {
  if (!name || name.length > 255) {
    throw new Error('Invalid agent name: must be 1-255 characters');
  }

  // フォーマットチェック（英数字、ハイフン、アンダースコアのみ）
  // これにより `.`, `..`, 空白、特殊文字がすべて拒否される
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Invalid agent name: only alphanumeric, hyphens, and underscores are allowed');
  }

  // 以下は正規表現で既に拒否されるが、明示的にチェック（防衛的プログラミング）
  if (name === '.' || name === '..') {
    throw new Error('Invalid agent name: "." and ".." are not allowed');
  }

  if (name.includes('/') || name.includes('\\')) {
    throw new Error('Invalid agent name: path separators are not allowed');
  }

  if (name.includes('\0')) {
    throw new Error('Invalid agent name: null bytes are not allowed');
  }

  if (name !== name.trim()) {
    throw new Error('Invalid agent name: leading/trailing whitespace is not allowed');
  }
}

/**
 * エージェントディレクトリのパスを取得
 */
function getAgentsDir(ctx: UserContext): string {
  return join(ctx.userHome, AGENTS_DIR);
}

/**
 * 特定エージェントのファイルパスを取得（フラット構造）
 * 内部でエージェント名のバリデーションを行うため、呼び出し元での重複チェックは不要
 */
function getAgentFilePath(ctx: UserContext, agentName: string): string {
  validateAgentName(agentName);
  return join(getAgentsDir(ctx), `${agentName}.md`);
}

/**
 * YAML frontmatter + content を Markdown ファイルコンテンツとして生成
 * 元の frontmatter オブジェクトを保持し、必要な部分だけをマージ
 * セキュリティ: forceQuotes: true により特殊文字を安全にエスケープ
 */
function generateAgentFileContent(frontmatter: Record<string, unknown>, content: string): string {
  // js-yaml で YAML を生成（マルチライン文字列も適切に処理）
  const frontmatterYaml = yaml
    .dump(frontmatter, {
      lineWidth: -1, // 折り返しなし
      quotingType: '"',
      forceQuotes: true, // 常にクォートしてYAMLインジェクション攻撃を防止
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
function parseAgentFile(fileContent: string): {
  frontmatter: Record<string, unknown>;
  name: string;
  version: string;
  description: string;
  tools?: string;
  metadata?: AgentMetadata;
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

    // tools をトップレベルから取得（文字列として）
    const tools = typeof parsed.tools === 'string' ? parsed.tools : undefined;

    // メタデータをパース（version は metadata 内に配置）
    let metadata: AgentMetadata | undefined;
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
      tools,
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
 * エージェント一覧を取得（フラット構造）
 */
export async function listAgents(ctx: UserContext): Promise<AgentInfo[]> {
  const agentsDir = getAgentsDir(ctx);

  try {
    await ensureDirectory(agentsDir);
    const entries = await readdir(agentsDir, { withFileTypes: true });

    const agents: AgentInfo[] = [];

    for (const entry of entries) {
      // .md ファイルのみを対象とする
      if (!entry.isFile() || extname(entry.name) !== '.md') continue;

      const agentFilePath = join(agentsDir, entry.name);

      try {
        const stats = await stat(agentFilePath);
        const content = await readFile(agentFilePath, 'utf-8');
        const parsed = parseAgentFile(content);

        if (!parsed) continue;

        // ファイル名から .md を除いたものをエージェント名として使用
        const agentName = basename(entry.name, '.md');

        agents.push({
          name: parsed.name || agentName,
          version: parsed.version,
          description: parsed.description,
          tools: parsed.tools,
          file_path: entry.name,
          metadata: parsed.metadata,
          created_at: stats.birthtime.toISOString(),
          updated_at: stats.mtime.toISOString(),
        });
      } catch (error) {
        // ファイル読み取りエラーはログに記録
        logger.warn('Failed to read agent file', {
          agentFile: entry.name,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    return agents.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    // ディレクトリが存在しない場合は空配列を返す
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * エージェント詳細を取得（フラット構造）
 */
export async function getAgent(ctx: UserContext, agentName: string): Promise<AgentDetail | null> {
  // バリデーションは getAgentFilePath 内で実行される
  const agentFilePath = getAgentFilePath(ctx, agentName);

  try {
    const stats = await stat(agentFilePath);
    const fileContent = await readFile(agentFilePath, 'utf-8');
    const parsed = parseAgentFile(fileContent);

    if (!parsed) return null;

    return {
      name: parsed.name || agentName,
      version: parsed.version,
      description: parsed.description,
      tools: parsed.tools,
      file_path: `${agentName}.md`,
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
 * エージェントを作成（フラット構造）
 */
export async function createAgent(
  ctx: UserContext,
  request: AgentCreateRequest,
  authorName?: string
): Promise<AgentInfo> {
  const { name, version, description, content, tools } = request;

  // バリデーションは getAgentFilePath 内で実行される
  const agentFilePath = getAgentFilePath(ctx, name);
  const agentsDir = getAgentsDir(ctx);

  // ディレクトリを確保
  await ensureDirectory(agentsDir);

  // 既存チェック
  try {
    await stat(agentFilePath);
    throw new Error(`Agent '${name}' already exists`);
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

  // tools をトップレベルに追加（文字列として）
  if (tools && tools.trim().length > 0) {
    frontmatter.tools = tools;
  }

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

  // metadata を AgentMetadata 型として構築
  const metadata: AgentMetadata | undefined =
    Object.keys(metadataObj).length > 0
      ? {
          version: version || undefined,
          author: authorName || undefined,
        }
      : undefined;

  // ファイル作成
  const fileContent = generateAgentFileContent(frontmatter, content);
  await writeFile(agentFilePath, fileContent, 'utf-8');

  const stats = await stat(agentFilePath);

  return {
    name,
    version,
    description,
    tools,
    file_path: `${name}.md`,
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
 * エージェントファイルのメタデータをマージして書き戻す
 * @param destFile - 対象ファイルパス
 * @param importMetadata - インポート時に追加するメタデータ
 * @param agentName - エージェント名（ファイル名から抽出）
 * @returns AgentInfo | null
 */
async function mergeAndWriteAgentMetadata(
  destFile: string,
  importMetadata: AgentMetadata,
  agentName: string
): Promise<AgentInfo | null> {
  // 1. ファイルを読み取り、パース
  const content = await readFile(destFile, 'utf-8');
  const parsed = parseAgentFile(content);

  if (!parsed) {
    return null;
  }

  // 2. frontmatter の metadata とインポート情報をマージ
  const frontmatter = { ...parsed.frontmatter };
  const existingMetadata =
    frontmatter.metadata && typeof frontmatter.metadata === 'object'
      ? (frontmatter.metadata as Record<string, unknown>)
      : {};
  const mergedMetadataObj = { ...existingMetadata };

  if (importMetadata.source) {
    mergedMetadataObj.source = importMetadata.source;
  }

  frontmatter.metadata = mergedMetadataObj;

  // 3. AgentMetadata 型として構築
  const mergedMetadata: AgentMetadata = {
    version: typeof mergedMetadataObj.version === 'string' ? mergedMetadataObj.version : undefined,
    author: typeof mergedMetadataObj.author === 'string' ? mergedMetadataObj.author : undefined,
    source: typeof mergedMetadataObj.source === 'string' ? mergedMetadataObj.source : undefined,
  };

  // 4. ファイルを書き戻し
  const newFileContent = generateAgentFileContent(frontmatter, parsed.content);
  await writeFile(destFile, newFileContent, 'utf-8');

  const stats = await stat(destFile);

  // 5. AgentInfo を返却
  return {
    name: parsed.name || agentName,
    version: parsed.version,
    description: parsed.description,
    tools: parsed.tools,
    file_path: basename(destFile),
    metadata: mergedMetadata,
    created_at: stats.birthtime.toISOString(),
    updated_at: stats.mtime.toISOString(),
  };
}

/**
 * 単一のエージェントを一時ディレクトリからユーザーのエージェントディレクトリにコピー（フラット構造）
 *
 * @param agentsDir - コピー先のエージェントディレクトリ（絶対パス）
 * @param tempDir - 一時ディレクトリ（絶対パス、ベースディレクトリとして使用）
 * @param importPath - インポート対象のパス（tempDir からの相対パス、例: "my-agent.md" または "agents/my-agent.md"）
 *                     絶対パスやパストラバーサル（"../"）は validatePathWithinBase でセキュリティエラーとなる
 * @param importMetadata - インポート時に付与するメタデータ
 * @returns コピーされたエージェント情報、または存在しない場合は null
 */
async function copyAgentFromDir(
  agentsDir: string,
  tempDir: string,
  importPath: string,
  importMetadata: AgentMetadata
): Promise<AgentInfo | null> {
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

  if (sourceStats.isFile() && extname(sourcePath) === '.md') {
    // .md ファイルの場合: そのままコピー
    const agentName = basename(sourcePath, '.md');
    const destFile = join(agentsDir, `${agentName}.md`);

    await cp(sourcePath, destFile, { force: true });

    // ヘルパー関数を使用してメタデータをマージ・書き戻し
    return await mergeAndWriteAgentMetadata(destFile, importMetadata, agentName);
  } else if (sourceStats.isDirectory()) {
    // ディレクトリの場合: 中の .md ファイルをコピー
    const entries = await readdir(sourcePath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && extname(entry.name) === '.md') {
        const sourceFile = join(sourcePath, entry.name);
        const destFile = join(agentsDir, entry.name);

        await cp(sourceFile, destFile, { force: true });

        // ヘルパー関数を使用してメタデータをマージ・書き戻し
        const result = await mergeAndWriteAgentMetadata(
          destFile,
          importMetadata,
          basename(entry.name, '.md')
        );

        if (result) {
          return result;
        }
      }
    }
  }

  return null;
}

/**
 * Git リポジトリからエージェントをインポート（複数パス対応、sparse-checkout で効率化）
 */
export async function importAgentsFromGit(
  ctx: UserContext,
  request: AgentImportRequest
): Promise<AgentInfo[]> {
  const { repository_url, paths, branch = 'main' } = request;
  const agentsDir = getAgentsDir(ctx);

  // ブランチ名のバリデーション（コマンドインジェクション対策）
  validateBranchName(branch);

  // 一時ディレクトリを作成
  const tempDir = join(tmpdir(), `agent-import-${randomUUID()}`);

  // metadata を構築（source のみ）
  const importMetadata: AgentMetadata = {
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

    await ensureDirectory(agentsDir);

    // 4. 各パスを並列でコピー
    const results = await Promise.all(
      paths.map(importPath => copyAgentFromDir(agentsDir, tempDir, importPath, importMetadata))
    );

    return results.filter((agent): agent is AgentInfo => agent !== null);
  } finally {
    // 5. 一時ディレクトリを削除
    await removeDirectory(tempDir);
  }
}

/**
 * エージェントを削除（フラット構造）
 */
export async function deleteAgent(ctx: UserContext, agentName: string): Promise<boolean> {
  // バリデーションは getAgentFilePath 内で実行される
  const agentFilePath = getAgentFilePath(ctx, agentName);

  try {
    await stat(agentFilePath);
    await rm(agentFilePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * エージェントを更新（フラット構造）
 */
export async function updateAgent(
  ctx: UserContext,
  agentName: string,
  request: AgentUpdateRequest
): Promise<AgentInfo | null> {
  // バリデーションは getAgentFilePath 内で実行される
  const agentFilePath = getAgentFilePath(ctx, agentName);

  try {
    // 既存エージェントが存在するか確認
    try {
      await stat(agentFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    // raw_content をそのまま保存
    await writeFile(agentFilePath, request.raw_content, 'utf-8');

    // 保存後にパースして情報を取得
    const parsed = parseAgentFile(request.raw_content);
    const stats = await stat(agentFilePath);

    if (!parsed) {
      // パースに失敗しても保存は成功しているので、基本情報だけ返す
      return {
        name: agentName,
        version: '',
        description: '',
        tools: undefined,
        file_path: `${agentName}.md`,
        created_at: stats.birthtime.toISOString(),
        updated_at: stats.mtime.toISOString(),
      };
    }

    return {
      name: parsed.name || agentName,
      version: parsed.version,
      description: parsed.description,
      tools: parsed.tools,
      file_path: `${agentName}.md`,
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
 * Workspace上のエージェントパスを生成
 * /Workspace/Users/{userName}/.assistant/agents
 */
function getWorkspaceAgentsPath(userName: string): string {
  return `/Workspace/Users/${userName}/.assistant/agents`;
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
 * エージェントを Workspace にバックアップ
 * ローカルの .claude/agents/ → /Workspace/Users/{user}/.assistant/agents/
 */
export async function backupAgentsToWorkspace(ctx: UserContext): Promise<AgentBackupResponse> {
  const localAgentsDir = getAgentsDir(ctx);
  const workspacePath = getWorkspaceAgentsPath(ctx.userName);

  // 認証情報を取得
  const authProvider = await ctx.getAuthProvider();
  if (authProvider.type !== 'pat') {
    throw new Error('PAT is required for backup operation');
  }

  // ローカルエージェントディレクトリが存在するか確認
  try {
    await stat(localAgentsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        success: true,
        message: 'No agents to backup',
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
    ['workspace', 'import-dir', localAgentsDir, workspacePath, '--overwrite'],
    {
      authProvider,
      timeout: 120000,
    }
  );

  return {
    success: true,
    message: 'Agents backed up successfully',
    workspace_path: workspacePath,
  };
}

/**
 * Workspace からエージェントをリストア
 * /Workspace/Users/{user}/.assistant/agents/ → ローカルの .claude/agents/
 */
export async function restoreAgentsFromWorkspace(ctx: UserContext): Promise<AgentRestoreResponse> {
  const localAgentsDir = getAgentsDir(ctx);
  const workspacePath = getWorkspaceAgentsPath(ctx.userName);

  // 認証情報を取得
  const authProvider = await ctx.getAuthProvider();
  if (authProvider.type !== 'pat') {
    throw new Error('PAT is required for restore operation');
  }

  // 1. ローカルの既存ディレクトリを削除
  // セキュリティ: ユーザーホーム配下であることを検証
  const safeAgentsDir = await validatePathWithinBase(localAgentsDir, ctx.userHome);
  await removeDirectory(safeAgentsDir);

  // 2. ローカルディレクトリを再作成
  await ensureDirectory(localAgentsDir);

  // 3. Workspace からエクスポート
  await spawnDatabricksCli(
    ['workspace', 'export-dir', workspacePath, localAgentsDir, '--overwrite'],
    {
      authProvider,
      timeout: 120000,
    }
  );

  return {
    success: true,
    message: 'Agents restored successfully',
  };
}

// テスト用エクスポート（内部関数のユニットテスト用）
export const __testing = {
  parseAgentFile,
  generateAgentFileContent,
  extractAuthorFromGitUrl,
  validateBranchName,
  validateAgentName,
  getWorkspaceAgentsPath,
  mergeAndWriteAgentMetadata,
  copyAgentFromDir,
};
