import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import {
  query,
  type McpServerConfig,
  type SDKMessage,
  type SDKResultMessage,
  type SDKSystemMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { UUID } from 'crypto';
import type {
  SessionCreateRequest,
  SessionCreateResponse,
  SessionContextResponse,
  SessionListQuery,
  SessionListResponse,
  SessionResponse,
  SessionStatus,
  SessionCreateEventData,
  SessionUpdateRequest,
  CodedError,
  DatabricksWorkspaceSource,
  DatabricksAppsOutcome,
} from '@repo/types';
import { ClaudeSettings } from '../models/claude-settings.model.js';
import { buildSystemPromptConfig } from '../utils/system-prompt.helper.js';
import { sessions } from '../db/schema.js';
import { createDbAppsMcpServer } from '../lib/mcp-databricks-apps.js';
import { insertSessionEventInTx } from '../db/helpers.js';
import { ensureDirectory, removeDirectory } from '../utils/directory.js';
import { DatabricksAppsClient } from '../lib/databricks-apps-client.js';
import { wsManager } from './websocket-manager.service.js';
import { SessionId } from '../models/session.model.js';
import type { UserContext } from '../lib/user-context.js';
import path from 'node:path';

/** セッションID → AbortController のマッピング（abort 用） */
const sessionAbortControllers = new Map<string, AbortController>();

/**
 * 単一の SDKUserMessage を AsyncIterable として返す
 * query() 関数に構造化コンテンツを渡すために使用
 */
async function* singleMessageIterable(msg: SDKUserMessage): AsyncIterable<SDKUserMessage> {
  yield msg;
}

/**
 * DB から取得するセッションカラムの選択定義
 */
const SESSION_SELECT_COLUMNS = {
  id: sessions.id,
  title: sessions.title,
  status: sessions.status,
  context: sessions.context,
  createdAt: sessions.createdAt,
  updatedAt: sessions.updatedAt,
} as const;

/**
 * SessionCreateEventData を SDKUserMessage 形式に変換
 */
function convertToSDKUserMessage(
  eventData: SessionCreateEventData,
  sessionId: SessionId
): SDKUserMessage {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: eventData.message.content,
    },
    parent_tool_use_id: eventData.parent_tool_use_id,
    uuid: eventData.uuid as UUID,
    session_id: sessionId.toString(),
  };
}

/**
 * イベントを WebSocket にブロードキャストし、DB に保存する（並列処理）
 * WebSocket 送信は即座に行い、DB 書き込みは待たない
 *
 * @param sessionId - SessionId オブジェクト
 * @param options.skipDbSave - true の場合、DB 保存をスキップ（init イベント前に使用）
 */
function saveAndBroadcastEvent(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId,
  message: SDKMessage,
  options: { skipDbSave?: boolean } = {}
): Promise<void> {
  const eventUuid = 'uuid' in message ? (message.uuid as string) : crypto.randomUUID();
  const eventSubtype = 'subtype' in message ? (message.subtype as string | undefined) : undefined;

  // WebSocket にブロードキャスト（TypeID 形式で送信）
  wsManager.broadcast(sessionId.toString(), message);

  // DB に保存（skipDbSave が false の場合のみ）
  if (!options.skipDbSave) {
    return fastify
      .withUserContext(userId, async tx => {
        await insertSessionEventInTx(tx, {
          uuid: eventUuid,
          sessionId: sessionId.toUUID(),
          type: message.type,
          subtype: eventSubtype ?? null,
          message: message,
        });
      })
      .catch(error => {
        fastify.log.error(
          { sessionId: sessionId.toString(), eventUuid, error },
          'Failed to save event to DB'
        );
      });
  }
  return Promise.resolve();
}

/**
 * init イベントを待機する
 * セッションは既に作成済みなので、init 受信時に UPDATE + init イベント INSERT を行う
 */
interface WaitForInitResult {
  sdkSessionId: string;
  iterator: AsyncIterator<SDKMessage, void>;
}

async function waitForInit(
  response: AsyncIterable<SDKMessage>,
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId
): Promise<WaitForInitResult> {
  const iterator = response[Symbol.asyncIterator]();

  while (true) {
    const { value: message, done } = await iterator.next();

    if (done || !message) {
      throw new Error('Stream ended before init event');
    }

    // init イベント前: WebSocket 送信のみ（DB 保存しない）
    saveAndBroadcastEvent(fastify, userId, sessionId, message, { skipDbSave: true });

    // init イベントを検出 (type: system, subtype: init)
    if (message.type === 'system' && message.subtype === 'init') {
      const initMessage = message as SDKSystemMessage;

      // sessions テーブル UPDATE + init イベント INSERT を1トランザクションで実行
      await fastify.withUserContext(userId, async tx => {
        // sessions テーブルを UPDATE（status を running に、sdkSessionId を設定）
        await tx
          .update(sessions)
          .set({
            status: 'running',
            sdkSessionId: initMessage.session_id || null,
          })
          .where(eq(sessions.id, sessionId.toUUID()));

        // init イベントを session_events テーブルに INSERT
        await insertSessionEventInTx(tx, {
          uuid: initMessage.uuid,
          sessionId: sessionId.toUUID(),
          type: initMessage.type,
          subtype: initMessage.subtype,
          message: initMessage,
        });
      });

      return {
        sdkSessionId: initMessage.session_id,
        iterator,
      };
    }
  }
}

/**
 * init 以降のイベントをバックグラウンドで処理する
 */
async function processRemainingEvents(
  iterator: AsyncIterator<SDKMessage, void>,
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId
): Promise<void> {
  try {
    while (true) {
      const { value: message, done } = await iterator.next();

      if (done || !message) {
        break;
      }

      // WebSocket 送信 & DB 保存（並列）
      saveAndBroadcastEvent(fastify, userId, sessionId, message);

      // result イベント時にセッション状態を idle に更新
      if (message.type === 'result') {
        await fastify.withUserContext(userId, async tx => {
          await tx
            .update(sessions)
            .set({ status: 'idle' })
            .where(eq(sessions.id, sessionId.toUUID()));
        });
      }
    }
  } catch (error) {
    fastify.log.error(
      { sessionId: sessionId.toString(), error },
      'Error processing remaining events'
    );

    // セッション状態を error に更新
    try {
      await fastify.withUserContext(userId, async tx => {
        await tx
          .update(sessions)
          .set({ status: 'error' })
          .where(eq(sessions.id, sessionId.toUUID()));
      });
    } catch (updateError) {
      fastify.log.error(
        { sessionId: sessionId.toString(), updateError },
        'Failed to update session status to error'
      );
    }

    throw error;
  } finally {
    // AbortController を削除（result イベント受信時 or エラー時）
    sessionAbortControllers.delete(sessionId.toString());
  }
}

/**
 * 新規セッションを作成する
 *
 * 処理フロー:
 * 1. TypeID で session_id 生成
 * 2. sessions INSERT (status='init') + user message INSERT
 * 3. claude-agent-sdk で query() 実行
 * 4. init イベント受信時に sessions UPDATE (status='running') + init イベント INSERT
 * 5. 即座にレスポンスを返し、残りのイベントはバックグラウンドで処理
 * 6. query() 失敗時は sessions status を 'error' に更新
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param request - セッション作成リクエスト
 * @param ctx - ユーザーコンテキスト
 * @returns セッション作成レスポンス
 */
export async function createSession(
  fastify: FastifyInstance,
  userId: string,
  request: SessionCreateRequest,
  ctx: UserContext
): Promise<SessionCreateResponse> {
  const { events, session_context, title } = request;

  // 1. SessionId を生成（UUIDv7 ベース）
  const sessionId = new SessionId();

  // 2. ユーザーメッセージのテキストを抽出
  const userEvent = events[0];
  const userContent = userEvent?.data.message.content ?? '';

  // 3. cwd の生成（userHome + sessionId）TypeID 形式で使用
  const { userHome } = ctx;
  /** Claude Code Working Directory  (e.g. /home/app/users/user1/session_xxx) */
  const cwd = path.join(userHome, sessionId.toString());

  await ensureDirectory(cwd);

  // 4. settings.local.json の生成（databricks_workspace がある場合）
  const workspaceSources = session_context.sources.filter(
    (s): s is DatabricksWorkspaceSource => s.type === 'databricks_workspace'
  );

  if (workspaceSources.length > 0) {
    const exportCommands = workspaceSources.map(source =>
      ClaudeSettings.createWorkspaceExportCommand(source.path)
    );
    const claudeSettings = new ClaudeSettings().addSessionStartHooks(exportCommands);
    await claudeSettings.saveToSession(cwd);
    fastify.log.info(
      { sessionId: sessionId.toString(), workspaceSources },
      'Created settings.local.json with SessionStart hooks'
    );
  }

  // 5. context オブジェクトの構築
  // databricks_apps outcome がある場合は app name を計算して設定
  const outcomes = session_context.outcomes.map(outcome => {
    if (outcome.type === 'databricks_apps') {
      return {
        ...outcome,
        name: `app-${sessionId.getSuffix()}`,
      };
    }
    return outcome;
  });

  const sessionContext: SessionContextResponse = {
    allowed_tools: [],
    disallowed_tools: [],
    cwd,
    model: session_context.model,
    sources: session_context.sources,
    outcomes,
  };

  // 5. タイムスタンプを設定（レスポンス用）
  const now = new Date();

  // 6. sessions と user message を先に INSERT (status='init')
  const userMessage = convertToSDKUserMessage(userEvent.data, sessionId);
  await fastify.withUserContext(userId, async tx => {
    await tx.insert(sessions).values({
      id: sessionId.toUUID(),
      userId,
      title: title ?? null,
      status: 'init',
      sdkSessionId: null,
      context: sessionContext,
    });

    await insertSessionEventInTx(tx, {
      uuid: userEvent.data.uuid,
      sessionId: sessionId.toUUID(),
      type: 'user',
      subtype: null,
      message: userMessage,
    });
  });

  // 7. アクセストークンを取得（PAT → SP フォールバック）
  let accessToken: string | undefined;
  try {
    accessToken = await ctx.getAccessToken();
  } catch (tokenError) {
    fastify.log.error(
      { sessionId: sessionId.toString(), userId, error: tokenError },
      'Failed to retrieve access token'
    );
    const error = new Error(
      'アクセストークンの取得中にエラーが発生しました。しばらく待ってから再試行してください。'
    ) as CodedError;
    error.code = 'TOKEN_RETRIEVAL_ERROR';
    throw error;
  }

  if (!accessToken) {
    const error = new Error(
      'アクセストークンが取得できません。PATを登録するか、管理者に連絡してください。'
    ) as CodedError;
    error.code = 'NO_ACCESS_TOKEN';
    throw error;
  }

  // 8. claude-agent-sdk で query 実行
  try {
    // userContent が配列（構造化コンテンツ）の場合は SDKUserMessage として渡す
    let prompt: string | AsyncIterable<SDKUserMessage>;
    if (Array.isArray(userContent) && userEvent) {
      prompt = singleMessageIterable({
        type: 'user',
        message: {
          role: 'user',
          content: userContent,
        },
        parent_tool_use_id: null,
        uuid: userEvent.data.uuid as UUID,
        session_id: sessionId.toString(),
      });
    } else {
      prompt = typeof userContent === 'string' ? userContent : '';
    }

    // outcomes に基づいて systemPrompt を構築
    const systemPromptConfig = buildSystemPromptConfig(session_context.outcomes);

    // AbortController を作成（abort 用）
    const abortController = new AbortController();

    // outcomes に databricks_apps があるか確認
    const hasAppsOutcome = session_context.outcomes.some(o => o.type === 'databricks_apps');

    // MCP サーバーを構築（固定で設定、allowedTools で制御）
    const mcpServers: Record<string, McpServerConfig> = {};

    // sql: OBO token がある場合に有効（ユーザーの Databricks 権限で SQL 実行）
    const oboToken = ctx.oboAccessToken;
    if (oboToken) {
      mcpServers.sql = {
        type: 'http',
        url: `https://${fastify.config.DATABRICKS_HOST}/api/2.0/mcp/sql`,
        headers: {
          Authorization: `Bearer ${oboToken}`,
        },
      };
    }

    // apps: Databricks Apps MCP サーバーを追加
    mcpServers.apps = createDbAppsMcpServer(
      sessionId,
      fastify.config.DATABRICKS_HOST,
      fastify.config.DATABRICKS_CLIENT_ID,
      fastify.config.DATABRICKS_CLIENT_SECRET,
      ctx.userName
    );

    // allowedTools を構築（MCP ツールは allowedTools で制御）
    const allowedTools = [
      'Skill',
      'Bash',
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'WebSearch',
      'WebFetch',
      // mcp__sql は常時許可
      'mcp__sql__execute_sql_read_only',
      'mcp__sql__poll_sql_result',
    ];

    // databricks_apps outcome がある場合は mcp__apps 関連ツールを許可
    if (hasAppsOutcome) {
      allowedTools.push('mcp__apps__*');
    }

    const response = query({
      prompt,
      options: {
        abortController,
        cwd: sessionContext.cwd,
        model: session_context.model,
        maxTurns: 100,
        settingSources: ['user', 'project', 'local'],
        permissionMode: 'bypassPermissions',
        systemPrompt: systemPromptConfig,
        tools: {
          type: 'preset',
          preset: 'claude_code',
        },
        mcpServers,
        allowedTools,
        env: {
          PATH: fastify.config.PATH,
          HOME: userHome,
          CLAUDE_CONFIG_DIR: path.join(userHome, '.claude'),
          // Session
          SESSION_ID: sessionId.toString(),
          DATABRICKS_WORKSPACE_PATH: workspaceSources[0]?.path,
          // Claude Code
          ANTHROPIC_BASE_URL: fastify.config.ANTHROPIC_BASE_URL,
          ANTHROPIC_AUTH_TOKEN: accessToken,
          ANTHROPIC_CUSTOM_HEADERS: 'x-databricks-disable-beta-headers: true',
          ANTHROPIC_DEFAULT_OPUS_MODEL: fastify.config.ANTHROPIC_DEFAULT_OPUS_MODEL,
          ANTHROPIC_DEFAULT_SONNET_MODEL: fastify.config.ANTHROPIC_DEFAULT_SONNET_MODEL,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: fastify.config.ANTHROPIC_DEFAULT_HAIKU_MODEL,
          // Databricks
          DATABRICKS_HOST: `https://${fastify.config.DATABRICKS_HOST}`,
          DATABRICKS_TOKEN: accessToken,
        },
        sandbox: {
          // ネットワーク疎通を通せないので無効化しておく
          enabled: false,
        },
      },
    });

    // AbortController を登録（abort 用）
    sessionAbortControllers.set(sessionId.toString(), abortController);

    // 8. init イベントまで待機（status を 'running' に UPDATE）
    const { iterator } = await waitForInit(response, fastify, userId, sessionId);

    // 9. バックグラウンド処理開始（await しない）
    processRemainingEvents(iterator, fastify, userId, sessionId).catch(error => {
      fastify.log.error(
        { sessionId: sessionId.toString(), error },
        'Background event processing failed'
      );
    });
  } catch (error) {
    // SDK呼び出し失敗時: sessions status を 'error' に更新
    fastify.log.error({ sessionId: sessionId.toString(), error }, 'SDK query failed');
    await fastify.withUserContext(userId, async tx => {
      await tx.update(sessions).set({ status: 'error' }).where(eq(sessions.id, sessionId.toUUID()));
    });
    throw error;
  }

  // 10. 即座にレスポンス返却（TypeID 形式）
  return {
    id: sessionId.toString(),
    session_status: 'running',
    title: title ?? null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    session_context: sessionContext,
  };
}

/**
 * ユーザーのセッション一覧を取得する
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param options - クエリオプション（limit, status）
 * @returns セッション一覧レスポンス
 */
export async function listSessions(
  fastify: FastifyInstance,
  userId: string,
  options: SessionListQuery = {}
): Promise<SessionListResponse> {
  const { limit = 20, status } = options;

  // limit のバリデーション（1-100）
  const safeLimit = Math.min(Math.max(1, limit), 100);

  return fastify.withUserContext(userId, async tx => {
    // フィルタ条件を構築
    const whereClause = status ? eq(sessions.status, status) : undefined;

    // limit + 1 で取得して has_more を判定
    const rows = await tx
      .select(SESSION_SELECT_COLUMNS)
      .from(sessions)
      .where(whereClause)
      .orderBy(desc(sessions.updatedAt))
      .limit(safeLimit + 1);

    // has_more 判定
    const hasMore = rows.length > safeLimit;
    const resultRows = hasMore ? rows.slice(0, safeLimit) : rows;

    // SessionResponse 形式に変換
    const data: SessionResponse[] = resultRows.map(toSessionResponse);

    return {
      data,
      first_id: data.length > 0 ? data[0].id : '',
      last_id: data.length > 0 ? data[data.length - 1].id : '',
      has_more: hasMore,
    };
  });
}

/**
 * DB行をSessionResponseに変換するヘルパー
 * DB の UUID を TypeID 形式に変換してレスポンスを返す
 */
function toSessionResponse(row: {
  id: string;
  title: string | null;
  status: string;
  context: unknown;
  createdAt: Date;
  updatedAt: Date;
}): SessionResponse {
  const sessionId = SessionId.fromUUID(row.id);
  return {
    id: sessionId.toString(),
    title: row.title,
    session_status: row.status as SessionStatus,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    session_context: (row.context as SessionContextResponse) ?? null,
  };
}

/**
 * 指定されたセッションを取得する
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param sessionId - SessionId オブジェクト
 * @returns セッション情報（見つからない場合は null）
 */
export async function getSession(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId
): Promise<SessionResponse | null> {
  return fastify.withUserContext(userId, async tx => {
    const rows = await tx
      .select(SESSION_SELECT_COLUMNS)
      .from(sessions)
      .where(eq(sessions.id, sessionId.toUUID()))
      .limit(1);

    if (rows.length === 0) return null;

    return toSessionResponse(rows[0]);
  });
}

/**
 * セッションを更新する（タイトルのみ）
 * ステータス変更は archiveSession() を使用してください
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param sessionId - SessionId オブジェクト
 * @param request - 更新リクエスト
 * @returns 更新後のセッション情報（見つからない場合は null）
 */
export async function updateSession(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId,
  request: SessionUpdateRequest
): Promise<SessionResponse | null> {
  const { title } = request;

  return fastify.withUserContext(userId, async tx => {
    // 更新を実行（RETURNING で更新後の値を取得）
    const updateFields: { title?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (title !== undefined) {
      updateFields.title = title;
    }

    const rows = await tx
      .update(sessions)
      .set(updateFields)
      .where(eq(sessions.id, sessionId.toUUID()))
      .returning(SESSION_SELECT_COLUMNS);

    if (rows.length === 0) return null;

    return toSessionResponse(rows[0]);
  });
}

/**
 * 既存セッションにメッセージを送信する
 *
 * 処理フロー:
 * 1. セッション取得（sdkSessionId, status, context を取得）
 * 2. archived → エラー throw
 * 3. sdkSessionId が null → エラー throw（init 中）
 * 4. その他 → 即時処理を開始
 *    - user message を session_events に INSERT
 *    - sessions.status を 'running' に UPDATE
 *    - query({ resume: sdkSessionId, prompt }) で SDK 呼び出し
 *    - バックグラウンドでイベント処理
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param sessionId - SessionId オブジェクト
 * @param userMessage - ユーザーメッセージ（SDKUserMessage）
 * @param ctx - ユーザーコンテキスト
 */
export async function sendMessageToSession(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId,
  userMessage: SDKUserMessage,
  ctx: UserContext
): Promise<void> {
  // 1. セッション情報を取得
  const sessionRow = await fastify.withUserContext(userId, async tx => {
    const rows = await tx
      .select({
        sdkSessionId: sessions.sdkSessionId,
        status: sessions.status,
        context: sessions.context,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId.toUUID()))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!sessionRow) {
    throw new Error('Session not found');
  }

  // 2. archived の場合はエラー
  if (sessionRow.status === 'archived') {
    throw new Error('Session is archived');
  }

  // 3. sdkSessionId が null の場合はエラー（init 中）
  if (!sessionRow.sdkSessionId) {
    throw new Error('Session is not ready (still initializing)');
  }

  const sessionContext = sessionRow.context as SessionContextResponse;

  // 4. user message を DB に保存し、status を running に更新
  const eventUuid = userMessage.uuid ?? crypto.randomUUID();
  await fastify.withUserContext(userId, async tx => {
    // user message を session_events に INSERT
    await insertSessionEventInTx(tx, {
      uuid: eventUuid,
      sessionId: sessionId.toUUID(),
      type: 'user',
      subtype: null,
      message: userMessage,
    });

    // sessions.status を running に UPDATE
    await tx
      .update(sessions)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(sessions.id, sessionId.toUUID()));
  });

  // WebSocket でユーザーメッセージをブロードキャスト
  wsManager.broadcast(sessionId.toString(), userMessage);

  // 5. アクセストークンを取得（PAT → SP フォールバック）
  let accessToken: string | undefined;
  try {
    accessToken = await ctx.getAccessToken();
  } catch (tokenError) {
    fastify.log.error(
      { sessionId: sessionId.toString(), userId, error: tokenError },
      'Failed to retrieve access token'
    );
    const error = new Error(
      'アクセストークンの取得中にエラーが発生しました。しばらく待ってから再試行してください。'
    ) as CodedError;
    error.code = 'TOKEN_RETRIEVAL_ERROR';
    throw error;
  }

  if (!accessToken) {
    const error = new Error(
      'アクセストークンが取得できません。PATを登録するか、管理者に連絡してください。'
    ) as CodedError;
    error.code = 'NO_ACCESS_TOKEN';
    throw error;
  }
  const { userHome } = ctx;

  // 6. claude-agent-sdk で query 実行（resume オプション使用）
  try {
    // content が配列（構造化コンテンツ）の場合は SDKUserMessage として渡す
    const messageContent = userMessage.message.content;
    let prompt: string | AsyncIterable<SDKUserMessage>;
    if (Array.isArray(messageContent)) {
      prompt = singleMessageIterable(userMessage);
    } else {
      prompt = messageContent;
    }

    // outcomes に基づいて systemPrompt を構築
    const systemPromptConfig = buildSystemPromptConfig(sessionContext.outcomes);

    // AbortController を作成（abort 用）
    const abortController = new AbortController();

    const workspacePath = sessionContext.sources.find(
      (s): s is DatabricksWorkspaceSource => s.type === 'databricks_workspace'
    )?.path;

    // outcomes に databricks_apps があるか確認
    const hasAppsOutcome =
      sessionContext.outcomes?.some(o => o.type === 'databricks_apps') ?? false;

    // MCP サーバーを構築（固定で設定、allowedTools で制御）
    const mcpServers: Record<string, McpServerConfig> = {};

    // sql: OBO token がある場合に有効（ユーザーの Databricks 権限で SQL 実行）
    const oboToken = ctx.oboAccessToken;
    if (oboToken) {
      mcpServers.sql = {
        type: 'http',
        url: `https://${fastify.config.DATABRICKS_HOST}/api/2.0/mcp/sql`,
        headers: {
          Authorization: `Bearer ${oboToken}`,
        },
      };
    }

    // apps: Databricks Apps MCP サーバーを追加
    mcpServers.apps = createDbAppsMcpServer(
      sessionId,
      fastify.config.DATABRICKS_HOST,
      fastify.config.DATABRICKS_CLIENT_ID,
      fastify.config.DATABRICKS_CLIENT_SECRET,
      ctx.userName
    );

    // allowedTools を構築（MCP ツールは allowedTools で制御）
    const allowedTools = [
      'Skill',
      'Bash',
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'WebSearch',
      'WebFetch',
      // mcp__sql は常時許可
      'mcp__sql__execute_sql_read_only',
      'mcp__sql__poll_sql_result',
    ];

    // databricks_apps outcome がある場合は mcp__apps 関連ツールを許可
    if (hasAppsOutcome) {
      allowedTools.push('mcp__apps__*');
    }

    const response = query({
      prompt,
      options: {
        abortController,
        resume: sessionRow.sdkSessionId,
        cwd: sessionContext.cwd,
        model: sessionContext.model as 'opus' | 'sonnet' | 'haiku',
        maxTurns: 100,
        settingSources: ['user', 'project', 'local'],
        permissionMode: 'bypassPermissions',
        systemPrompt: systemPromptConfig,
        tools: {
          type: 'preset',
          preset: 'claude_code',
        },
        mcpServers,
        allowedTools,
        env: {
          PATH: fastify.config.PATH,
          HOME: userHome,
          CLAUDE_CONFIG_DIR: path.join(userHome, '.claude'),
          // Session
          CLAUDE_CODE_SESSION_ID: sessionRow.sdkSessionId,
          SESSION_ID: sessionId.toString(),
          DATABRICKS_WORKSPACE_PATH: workspacePath,
          // Claude Code
          ANTHROPIC_BASE_URL: fastify.config.ANTHROPIC_BASE_URL,
          ANTHROPIC_AUTH_TOKEN: accessToken,
          ANTHROPIC_CUSTOM_HEADERS: 'x-databricks-disable-beta-headers: true',
          ANTHROPIC_DEFAULT_OPUS_MODEL: fastify.config.ANTHROPIC_DEFAULT_OPUS_MODEL,
          ANTHROPIC_DEFAULT_SONNET_MODEL: fastify.config.ANTHROPIC_DEFAULT_SONNET_MODEL,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: fastify.config.ANTHROPIC_DEFAULT_HAIKU_MODEL,
          // Databricks
          DATABRICKS_HOST: `https://${fastify.config.DATABRICKS_HOST}`,
          DATABRICKS_TOKEN: accessToken,
        },
        sandbox: {
          // ネットワーク疎通を通せないので無効化しておく
          enabled: false,
        },
      },
    });

    // AbortController を登録（abort 用）
    sessionAbortControllers.set(sessionId.toString(), abortController);

    // イベント処理（resume の場合は init イベントがないので直接処理）
    const iterator = response[Symbol.asyncIterator]();
    processRemainingEvents(iterator, fastify, userId, sessionId).catch(error => {
      fastify.log.error(
        { sessionId: sessionId.toString(), error },
        'Background event processing failed'
      );
    });
  } catch (error) {
    // SDK呼び出し失敗時: sessions status を 'error' に更新
    fastify.log.error({ sessionId: sessionId.toString(), error }, 'SDK resume query failed');
    await fastify.withUserContext(userId, async tx => {
      await tx.update(sessions).set({ status: 'error' }).where(eq(sessions.id, sessionId.toUUID()));
    });
    throw error;
  }
}

/**
 * セッションをアーカイブする
 * ステータスを 'archived' に変更し、Working Directory を削除する
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param sessionId - SessionId オブジェクト
 * @param ctx - ユーザーコンテキスト
 * @returns アーカイブ後のセッション情報（見つからない場合は null）
 */
export async function archiveSession(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId,
  ctx: UserContext
): Promise<SessionResponse | null> {
  // user_home を取得（ベースディレクトリとして使用）
  const { userHome } = ctx;
  const host = fastify.config.DATABRICKS_HOST;

  return fastify.withUserContext(userId, async tx => {
    // 1. セッション情報を取得（cwd を取得するため）
    const sessionRows = await tx
      .select({ context: sessions.context })
      .from(sessions)
      .where(eq(sessions.id, sessionId.toUUID()))
      .limit(1);

    if (sessionRows.length === 0) return null;

    const context = sessionRows[0].context as SessionContextResponse | null;
    const cwd = context?.cwd;

    // 2. ステータスを archived に更新
    const rows = await tx
      .update(sessions)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(sessions.id, sessionId.toUUID()))
      .returning(SESSION_SELECT_COLUMNS);

    if (rows.length === 0) return null;

    // 3. Working Directory を削除（user_home 配下に制限、トランザクション外で非同期実行）
    if (cwd && userHome) {
      removeDirectory(cwd, userHome).catch(error => {
        fastify.log.error(
          { sessionId: sessionId.toString(), cwd, userHome, error },
          'Failed to remove working directory'
        );
      });
    }

    // 4. Databricks App を削除（databricks_apps outcome がある場合、トランザクション外で非同期実行）
    const appsOutcome = context?.outcomes?.find(
      (o): o is DatabricksAppsOutcome => o.type === 'databricks_apps' && !!o.name
    );
    if (appsOutcome?.name) {
      const appName = appsOutcome.name;
      const appsClient = new DatabricksAppsClient(
        host,
        fastify.config.DATABRICKS_CLIENT_ID,
        fastify.config.DATABRICKS_CLIENT_SECRET
      );
      appsClient
        .delete(appName)
        .then(() => {
          fastify.log.info(
            { sessionId: sessionId.toString(), appName },
            'Databricks App deleted successfully'
          );
        })
        .catch(error => {
          fastify.log.error(
            { sessionId: sessionId.toString(), appName, error },
            'Error deleting Databricks App'
          );
        });
    }

    return toSessionResponse(rows[0]);
  });
}

/**
 * セッションが abort 可能かチェック
 *
 * @param sessionId - SessionId オブジェクト
 * @returns abort 可能な場合は true
 */
export function canAbortSession(sessionId: SessionId): boolean {
  return sessionAbortControllers.has(sessionId.toString());
}

/**
 * Abort を実行（非同期）
 * user メッセージと result イベントを送信し、セッション状態を idle に更新する
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param sessionId - SessionId オブジェクト
 */
export async function executeAbort(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId
): Promise<void> {
  const sessionIdStr = sessionId.toString();
  const abortController = sessionAbortControllers.get(sessionIdStr);

  if (!abortController) return;

  // 1. abort を呼び出し（AbortController の削除は processRemainingEvents の finally で行う）
  abortController.abort();

  // 2. user メッセージを送信（画面表示用）- DB 保存完了を待機して順序を保証
  const userMessage = {
    type: 'user',
    uuid: crypto.randomUUID(),
    session_id: sessionIdStr,
    parent_tool_use_id: null,
    message: {
      role: 'user',
      content: [{ type: 'text', text: '[Request aborted by user]' }],
    },
  } as SDKUserMessage;
  await saveAndBroadcastEvent(fastify, userId, sessionId, userMessage);

  // 3. result イベントを送信（user メッセージの後に送信されることが保証される）
  const resultMessage = {
    type: 'result',
    subtype: 'error_during_execution',
    uuid: crypto.randomUUID(),
    session_id: sessionIdStr,
    is_error: false,
  } as SDKResultMessage;
  await saveAndBroadcastEvent(fastify, userId, sessionId, resultMessage);

  // 4. セッション状態を idle に更新
  await fastify.withUserContext(userId, async tx => {
    await tx.update(sessions).set({ status: 'idle' }).where(eq(sessions.id, sessionId.toUUID()));
  });
}
