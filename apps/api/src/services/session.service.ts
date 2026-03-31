import type { FastifyInstance } from 'fastify';
import { eq, desc, and, inArray } from 'drizzle-orm';
import {
  query,
  type McpServerConfig,
  type SDKMessage,
  type SDKResultMessage,
  type SDKSystemMessage,
  type SDKUserMessage,
  type SDKUserMessageReplay,
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
  DatabricksWorkspaceSource,
  DatabricksAppsOutcome,
} from '@repo/types';
import { ClaudeSettings } from '../models/claude-settings.model.js';
import { buildSystemPromptConfig } from '../utils/system-prompt.helper.js';
import { sessions } from '../db/schema.js';
import { createDbAppsMcpServer } from '../lib/mcp-databricks-apps.js';
import { insertSessionEventInTx } from '../db/helpers.js';
import { ensureDirectory, removeDirectory } from '../utils/directory.js';
import { validatePathWithinBase } from '../utils/path-validation.js';
import { DatabricksAppsClient } from '../lib/databricks-apps-client.js';
import { getAuthProvider } from '../lib/databricks-auth.js';
import { wsManager } from './websocket-manager.service.js';
import { enqueueSessionEvent } from './event-queue.service.js';
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
 * イベントをバッチバッファに追加し、WebSocket にブロードキャストする
 *
 * 1. バッチバッファに追加（非同期で DB 永続化）
 * 2. WebSocket にブロードキャスト
 *
 * @param sessionId - SessionId オブジェクト
 */
function saveAndBroadcastEvent(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId,
  message: SDKMessage
): void {
  const eventUuid = 'uuid' in message ? (message.uuid as string) : crypto.randomUUID();
  const eventSubtype = 'subtype' in message ? (message.subtype as string | undefined) : undefined;

  // 1. バッチバッファに追加（バッチサイズ到達 or インターバル経過で DB 永続化）
  enqueueSessionEvent(fastify, {
    userId,
    sessionId: sessionId.toString(),
    sessionUUID: sessionId.toUUID(),
    eventUuid,
    type: message.type,
    subtype: eventSubtype ?? null,
    message,
  });

  // 2. WebSocket にブロードキャスト
  wsManager.broadcast(sessionId.toString(), message);
}

/**
 * すべてのイベントをバックグラウンドで処理する
 * - init イベント: status='running' に更新、sdkSessionId を設定、初回 user message を broadcast
 * - result イベント: sessions.status を 'idle' に更新
 * - すべてのイベント: WebSocket 送信 & バッチ経由で DB 保存
 *
 * @param response - SDK からのイベントストリーム
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param sessionId - セッションID
 * @param initialUserEvent - 初回ユーザーイベント（createSession 時のみ）
 */
async function processAllEvents(
  response: AsyncIterable<SDKMessage>,
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId,
  initialUserEvent?: SessionCreateEventData
): Promise<void> {
  let hasError = false;

  try {
    for await (const message of response) {
      // バッチバッファに追加 & WebSocket 送信
      saveAndBroadcastEvent(fastify, userId, sessionId, message);

      // init イベント時に status='running' に更新、sdkSessionId を設定、初回 user message を broadcast
      if (message.type === 'system' && message.subtype === 'init') {
        const initMessage = message as SDKSystemMessage;

        // status='running' に更新 & sdkSessionId を設定
        await fastify.withUserContext(userId, async tx => {
          await tx
            .update(sessions)
            .set({
              status: 'running',
              sdkSessionId: initMessage.session_id || null,
            })
            .where(eq(sessions.id, sessionId.toUUID()));
        });

        // 初回 user message を SDKUserMessageReplay として broadcast & DB 保存
        if (initialUserEvent) {
          const userMessageReplay: SDKUserMessageReplay = {
            type: 'user',
            message: {
              role: 'user',
              content: initialUserEvent.message.content,
            },
            parent_tool_use_id: initialUserEvent.parent_tool_use_id,
            uuid: initialUserEvent.uuid as UUID,
            session_id: sessionId.toString(),
            isReplay: true,
          };
          saveAndBroadcastEvent(fastify, userId, sessionId, userMessageReplay);
        }
      }
    }
  } catch (error) {
    hasError = true;
    fastify.log.error({ sessionId: sessionId.toString(), error }, 'Error processing events');

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
    // AbortController を削除
    sessionAbortControllers.delete(sessionId.toString());

    // エラーでない場合は status を idle に更新
    // （result イベントの有無に関わらず、正常終了時に確実に idle にする）
    // 条件付き更新: status が init/running の場合のみ更新（競合状態を防ぐ）
    // - 新しいリクエストで既に running になっている場合は上書きしない
    // - error 状態は hasError フラグで保護済み
    if (!hasError) {
      try {
        await fastify.withUserContext(userId, async tx => {
          await tx
            .update(sessions)
            .set({ status: 'idle' })
            .where(
              and(
                eq(sessions.id, sessionId.toUUID()),
                inArray(sessions.status, ['init', 'running'])
              )
            );
        });
      } catch (updateError) {
        fastify.log.error(
          { sessionId: sessionId.toString(), updateError },
          'Failed to update session status to idle in finally'
        );
      }
    }
  }
}

/**
 * SDK query() 呼び出し〜バックグラウンドイベント処理のパイプラインパラメータ
 */
interface StartQueryPipelineParams {
  fastify: FastifyInstance;
  ctx: UserContext;
  sessionId: SessionId;
  /** テキストの場合は string、構造化コンテンツの場合は SDKUserMessage */
  prompt: string | SDKUserMessage;
  sessionContext: SessionContextResponse;
  /** resume 用の SDK session ID（新規セッションの場合は undefined） */
  sdkSessionId: string | undefined;
  /** init イベント後に broadcast する初回ユーザーイベント（createSession 時のみ） */
  initialUserEvent: SessionCreateEventData | undefined;
}

/**
 * SDK query() を呼び出し、バックグラウンドでイベント処理を開始する
 *
 * createSession と sendMessageToSession で共通のパイプライン。
 * sdkSessionId の有無で新規セッション / resume を切り替える。
 * エラー時は session status を 'error' に更新して throw する。
 */
async function startQueryPipeline(params: StartQueryPipelineParams): Promise<void> {
  const {
    fastify,
    ctx,
    sessionId,
    prompt: rawPrompt,
    sessionContext,
    sdkSessionId,
    initialUserEvent,
  } = params;
  const { userId, userHome } = ctx;

  try {
    // Prompt: 構造化コンテンツは AsyncIterable にラップ、文字列はそのまま
    let prompt: string | AsyncIterable<SDKUserMessage>;
    if (typeof rawPrompt === 'string') {
      prompt = rawPrompt;
    } else if (Array.isArray(rawPrompt.message.content)) {
      prompt = singleMessageIterable(rawPrompt);
    } else {
      prompt = rawPrompt.message.content as string;
    }

    const systemPromptConfig = buildSystemPromptConfig(sessionContext.outcomes);
    const abortController = new AbortController();
    const authProvider = await ctx.getAuthProvider();

    // MCP サーバーを構築
    const mcpServers: Record<string, McpServerConfig> = {};
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
    mcpServers.apps = createDbAppsMcpServer({ authProvider, sessionId });

    const workspacePath = sessionContext.sources.find(
      (s): s is DatabricksWorkspaceSource => s.type === 'databricks_workspace'
    )?.path;

    const response = query({
      prompt,
      options: {
        abortController,
        ...(sdkSessionId ? { resume: sdkSessionId } : {}),
        cwd: sessionContext.cwd,
        model: sessionContext.model,
        maxTurns: 100,
        settingSources: ['user', 'project', 'local'],
        permissionMode: 'bypassPermissions',
        systemPrompt: systemPromptConfig,
        mcpServers,
        tools: {
          type: 'preset',
          preset: 'claude_code',
        },
        allowedTools: sessionContext.allowed_tools,
        // WebSearch は Anthropic API に依存しているため固定で無効化
        disallowedTools: ['WebSearch', ...(sessionContext.disallowed_tools ?? [])],
        env: {
          PATH: fastify.config.PATH,
          HOME: userHome,
          CLAUDE_CONFIG_DIR: path.join(userHome, '.claude'),
          ...(sdkSessionId ? { CLAUDE_CODE_SESSION_ID: sdkSessionId } : {}),
          SESSION_ID: sessionId.toString(),
          ...(workspacePath ? { DATABRICKS_WORKSPACE_PATH: workspacePath } : {}),
          ANTHROPIC_BASE_URL: fastify.config.ANTHROPIC_BASE_URL,
          ANTHROPIC_AUTH_TOKEN: await authProvider.getToken(),
          ANTHROPIC_CUSTOM_HEADERS: 'x-databricks-disable-beta-headers: true',
          ANTHROPIC_DEFAULT_OPUS_MODEL: fastify.config.ANTHROPIC_DEFAULT_OPUS_MODEL,
          ANTHROPIC_DEFAULT_SONNET_MODEL: fastify.config.ANTHROPIC_DEFAULT_SONNET_MODEL,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: fastify.config.ANTHROPIC_DEFAULT_HAIKU_MODEL,
          ...authProvider.getEnvVars(),
        },
        sandbox: {
          enabled: true,
          autoAllowBashIfSandboxed: true,
          network: {
            allowedDomains: ['*'],
          },
        },
      },
    });

    sessionAbortControllers.set(sessionId.toString(), abortController);

    // バックグラウンド処理開始（await しない）
    processAllEvents(response, fastify, userId, sessionId, initialUserEvent).catch(error => {
      fastify.log.error(
        { sessionId: sessionId.toString(), error },
        'Background event processing failed'
      );
    });
  } catch (error) {
    fastify.log.error({ sessionId: sessionId.toString(), error }, 'SDK query failed');
    await fastify.withUserContext(userId, async tx => {
      await tx.update(sessions).set({ status: 'error' }).where(eq(sessions.id, sessionId.toUUID()));
    });
    throw error;
  }
}

/**
 * 新規セッションを作成する
 *
 * 処理フロー:
 * 1. TypeID で session_id 生成
 * 2. sessions INSERT (status='init')
 * 3. claude-agent-sdk で query() 実行
 * 4. 即座にレスポンスを返し、すべてのイベントはバックグラウンドで処理
 *    - init イベント時に status='running' に更新、sdkSessionId を設定、初回 user message を broadcast
 *    - result イベント時に sessions.status を 'idle' に更新
 * 5. query() 失敗時は sessions.status を 'error' に更新
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
    allowed_tools: session_context.allowed_tools,
    disallowed_tools: session_context.disallowed_tools,
    cwd,
    model: session_context.model,
    sources: session_context.sources,
    outcomes,
  };

  // 5. タイムスタンプを設定（レスポンス用）
  const now = new Date();

  // 6. sessions を INSERT (status='init')
  // user message は init イベント受信時に saveAndBroadcastEvent で処理
  await fastify.withUserContext(userId, async tx => {
    await tx.insert(sessions).values({
      id: sessionId.toUUID(),
      userId,
      title: title ?? null,
      status: 'init',
      sdkSessionId: null,
      context: sessionContext,
    });
  });

  // 7. SDK query パイプラインを開始
  const prompt: string | SDKUserMessage =
    Array.isArray(userContent) && userEvent
      ? {
          type: 'user',
          message: { role: 'user', content: userContent },
          parent_tool_use_id: null,
          uuid: userEvent.data.uuid as UUID,
          session_id: sessionId.toString(),
        }
      : typeof userContent === 'string'
        ? userContent
        : '';

  await startQueryPipeline({
    fastify,
    ctx,
    sessionId,
    prompt,
    sessionContext,
    sdkSessionId: undefined,
    initialUserEvent: userEvent?.data,
  });

  // 9. 即座にレスポンス返却（TypeID 形式）
  return {
    id: sessionId.toString(),
    session_status: 'init',
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

  // 5. SDK query パイプラインを開始（resume）
  await startQueryPipeline({
    fastify,
    ctx,
    sessionId,
    prompt: userMessage,
    sessionContext,
    sdkSessionId: sessionRow.sdkSessionId,
    initialUserEvent: undefined,
  });
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

  // AuthProvider をトランザクション外で取得（PAT 優先）
  const authProvider = await getAuthProvider(fastify, ctx.userId);

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
      validatePathWithinBase(cwd, userHome)
        .then(safeCwd => removeDirectory(safeCwd))
        .catch(error => {
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
      const appsClient = new DatabricksAppsClient(authProvider);
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

  // 1. abort を呼び出し（AbortController の削除は processAllEvents の finally で行う）
  abortController.abort();

  // 2. user メッセージを送信（画面表示用）
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
  saveAndBroadcastEvent(fastify, userId, sessionId, userMessage);

  // 3. result イベントを送信
  const resultMessage = {
    type: 'result',
    subtype: 'error_during_execution',
    uuid: crypto.randomUUID(),
    session_id: sessionIdStr,
    is_error: false,
  } as SDKResultMessage;
  saveAndBroadcastEvent(fastify, userId, sessionId, resultMessage);

  // 4. セッション状態を idle に更新
  await fastify.withUserContext(userId, async tx => {
    await tx.update(sessions).set({ status: 'idle' }).where(eq(sessions.id, sessionId.toUUID()));
  });
}
