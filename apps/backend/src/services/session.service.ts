import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import {
  query,
  type SDKMessage,
  type SDKSystemMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import { requestContext } from '@fastify/request-context';
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
} from '@repo/types';
import { sessions } from '../db/schema.js';
import { insertSessionEventInTx } from '../db/helpers.js';
import { ensureDirectory, removeDirectory } from '../utils/directory.js';
import { wsManager } from './websocket-manager.service.js';
import { SessionId } from '../models/session.model.js';
import path from 'node:path';

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
): void {
  const eventUuid = 'uuid' in message ? (message.uuid as string) : crypto.randomUUID();
  const eventSubtype = 'subtype' in message ? (message.subtype as string | undefined) : undefined;

  // WebSocket にブロードキャスト（TypeID 形式で送信）
  wsManager.broadcast(sessionId.toString(), message);

  // DB に保存（skipDbSave が false の場合のみ）
  if (!options.skipDbSave) {
    fastify
      .withUserContext(userId, async tx => {
        return insertSessionEventInTx(tx, {
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
 * @returns セッション作成レスポンス
 */
export async function createSession(
  fastify: FastifyInstance,
  userId: string,
  request: SessionCreateRequest
): Promise<SessionCreateResponse> {
  const { events, session_context, title } = request;

  // 1. SessionId を生成（UUIDv7 ベース）
  const sessionId = new SessionId();

  // 2. ユーザーメッセージのテキストを抽出
  const userEvent = events[0];
  const userContent = userEvent?.data.message.content ?? '';

  // 3. cwd の生成（userHome + sessionId）TypeID 形式で使用
  const userHome = requestContext.get('user_home') as string;
  /** Claude Code Working Directory  (e.g. /home/app/users/user1/session_xxx) */
  const cwd = path.join(userHome, sessionId.toString());

  await ensureDirectory(cwd);

  // 4. context オブジェクトの構築
  const sessionContext: SessionContextResponse = {
    allowed_tools: [],
    disallowed_tools: [],
    cwd,
    model: session_context.model,
    sources: session_context.sources,
    outcomes: session_context.outcomes,
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

  // 7. claude-agent-sdk で query 実行
  try {
    const response = query({
      prompt: userContent,
      options: {
        cwd: sessionContext.cwd,
        model: session_context.model,
        maxTurns: 100,
        settingSources: ['user', 'project', 'local'],
        permissionMode: 'bypassPermissions',
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
        },
        tools: {
          type: 'preset',
          preset: 'claude_code',
        },
        allowedTools: [
          'Skill',
          'Bash',
          'Read',
          'Write',
          'Edit',
          'Glob',
          'Grep',
          'WebSearch',
          'WebFetch',
        ],
        env: {
          PATH: fastify.config.PATH,
          HOME: userHome,
          CLAUDE_CONFIG_DIR: path.join(userHome, '.claude'),
          // Claude Code
          ANTHROPIC_BASE_URL: fastify.config.ANTHROPIC_BASE_URL,
          ANTHROPIC_AUTH_TOKEN: requestContext.get('pat'),
          ANTHROPIC_CUSTOM_HEADERS: 'x-databricks-disable-beta-headers: true',
          ANTHROPIC_DEFAULT_OPUS_MODEL: fastify.config.ANTHROPIC_DEFAULT_OPUS_MODEL,
          ANTHROPIC_DEFAULT_SONNET_MODEL: fastify.config.ANTHROPIC_DEFAULT_SONNET_MODEL,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: fastify.config.ANTHROPIC_DEFAULT_HAIKU_MODEL,
          // Databricks
          DATABRICKS_HOST: `https://${fastify.config.DATABRICKS_HOST}`,
        },
        sandbox: {
          enabled: true,
          autoAllowBashIfSandboxed: true,
        },
      },
    });

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
 * セッションをアーカイブする
 * ステータスを 'archived' に変更し、Working Directory を削除する
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param sessionId - SessionId オブジェクト
 * @returns アーカイブ後のセッション情報（見つからない場合は null）
 */
export async function archiveSession(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId
): Promise<SessionResponse | null> {
  // user_home を取得（ベースディレクトリとして使用）
  const userHome = requestContext.get('user_home') as string;

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

    return toSessionResponse(rows[0]);
  });
}
