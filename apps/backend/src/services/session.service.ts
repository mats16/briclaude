import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { typeid } from 'typeid-js';
import { query, type SDKMessage, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
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
} from '@repo/types';
import { sessions } from '../db/schema.js';
import { insertSessionEventInTx } from '../db/helpers.js';
import { wsManager } from './websocket-manager.service.js';

/**
 * SessionCreateEventData を SDKUserMessage 形式に変換
 */
function convertToSDKUserMessage(eventData: SessionCreateEventData, sessionId: string): SDKUserMessage {
  return {
    type: 'user',
    message: {
      role: 'user',
      content: eventData.message.content,
    },
    parent_tool_use_id: eventData.parent_tool_use_id,
    uuid: eventData.uuid as UUID,
    session_id: sessionId,
  };
}

/**
 * セッションのステータスを更新するヘルパー関数
 */
async function updateSessionStatus(
  fastify: FastifyInstance,
  userId: string,
  sessionId: string,
  status: SessionStatus
): Promise<void> {
  try {
    await fastify.withUserContext(userId, async tx => {
      await tx.update(sessions).set({ status }).where(eq(sessions.id, sessionId));
    });
  } catch (error) {
    fastify.log.error({ sessionId, status, error }, 'Failed to update session status');
  }
}

/**
 * イベントを WebSocket にブロードキャストし、DB に保存する（並列処理）
 * WebSocket 送信は即座に行い、DB 書き込みは待たない
 *
 * @param options.skipDbSave - true の場合、DB 保存をスキップ（init イベント前に使用）
 */
function saveAndBroadcastEvent(
  fastify: FastifyInstance,
  userId: string,
  sessionId: string,
  message: SDKMessage,
  options: { skipDbSave?: boolean } = {}
): void {
  const eventUuid = 'uuid' in message ? (message.uuid as string) : crypto.randomUUID();
  const eventSubtype = 'subtype' in message ? (message.subtype as string | undefined) : undefined;

  // WebSocket にブロードキャスト（SDKMessage をそのまま送信）
  wsManager.broadcastEvent(sessionId, message);

  // DB に保存（skipDbSave が false の場合のみ）
  if (!options.skipDbSave) {
    fastify
      .withUserContext(userId, async tx => {
        return insertSessionEventInTx(tx, {
          uuid: eventUuid,
          sessionId,
          type: message.type,
          subtype: eventSubtype ?? null,
          message: message,
        });
      })
      .catch(error => {
        fastify.log.error({ sessionId, eventUuid, error }, 'Failed to save event to DB');
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
  sessionId: string
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
      const sdkSessionId = message.session_id;

      // sessions テーブル UPDATE + init イベント INSERT を1トランザクションで実行
      await fastify.withUserContext(userId, async tx => {
        // sessions テーブルを UPDATE（status を running に、sdkSessionId を設定）
        await tx
          .update(sessions)
          .set({
            status: 'running',
            sdkSessionId: sdkSessionId || null,
          })
          .where(eq(sessions.id, sessionId));

        // init イベントを session_events テーブルに INSERT
        const initEventUuid = 'uuid' in message ? (message.uuid as string) : crypto.randomUUID();
        await insertSessionEventInTx(tx, {
          uuid: initEventUuid,
          sessionId,
          type: message.type,
          subtype: message.subtype ?? null,
          message: message,
        });
      });

      return {
        sdkSessionId,
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
  sessionId: string
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
          await tx.update(sessions).set({ status: 'idle' }).where(eq(sessions.id, sessionId));
        });
      }
    }
  } catch (error) {
    fastify.log.error({ sessionId, error }, 'Error processing remaining events');

    // セッション状態を error に更新
    try {
      await fastify.withUserContext(userId, async tx => {
        await tx.update(sessions).set({ status: 'error' }).where(eq(sessions.id, sessionId));
      });
    } catch (updateError) {
      fastify.log.error({ sessionId, updateError }, 'Failed to update session status to error');
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

  // 1. TypeID で session_id 生成
  const sessionId = typeid('session').toString();

  // 2. ユーザーメッセージのテキストを抽出
  const userEvent = events[0];
  const userContent = userEvent?.data.message.content ?? '';

  // 3. cwd の生成（SESSION_BASE_DIR + sessionId の末尾部分）
  const sessionIdSuffix = sessionId.replace('session_', '');
  const cwd = `${fastify.config.SESSION_BASE_DIR}/${sessionIdSuffix}`;

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
  const createdAt = now;
  const updatedAt = now;

  // 6. sessions と user message を先に INSERT (status='init')
  const userMessage = convertToSDKUserMessage(userEvent.data, sessionId);
  await fastify.withUserContext(userId, async tx => {
    await tx.insert(sessions).values({
      id: sessionId,
      userId,
      title: title ?? null,
      status: 'init',
      sdkSessionId: null,
      context: sessionContext,
    });

    await insertSessionEventInTx(tx, {
      uuid: userEvent.data.uuid,
      sessionId,
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
        cwd: '.',
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
          HOME: fastify.config.HOME,
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
      },
    });

    // 8. init イベントまで待機（status を 'running' に UPDATE）
    const { iterator } = await waitForInit(response, fastify, userId, sessionId);

    // 9. バックグラウンド処理開始（await しない）
    processRemainingEvents(iterator, fastify, userId, sessionId).catch(error => {
      fastify.log.error({ sessionId, error }, 'Background event processing failed');
    });
  } catch (error) {
    // SDK呼び出し失敗時: sessions status を 'error' に更新
    fastify.log.error({ sessionId, error }, 'SDK query failed');
    await updateSessionStatus(fastify, userId, sessionId, 'error');
    throw error;
  }

  // 10. 即座にレスポンス返却
  return {
    id: sessionId,
    session_status: 'running',
    title: title ?? null,
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
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
export async function getSessions(
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
      .select({
        id: sessions.id,
        title: sessions.title,
        status: sessions.status,
        context: sessions.context,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
      })
      .from(sessions)
      .where(whereClause)
      .orderBy(desc(sessions.updatedAt))
      .limit(safeLimit + 1);

    // has_more 判定
    const hasMore = rows.length > safeLimit;
    const resultRows = hasMore ? rows.slice(0, safeLimit) : rows;

    // SessionResponse 形式に変換
    const data: SessionResponse[] = resultRows.map(row => ({
      id: row.id,
      title: row.title,
      session_status: row.status as SessionStatus,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      session_context: (row.context as SessionContextResponse) ?? null,
    }));

    return {
      data,
      first_id: data.length > 0 ? data[0].id : '',
      last_id: data.length > 0 ? data[data.length - 1].id : '',
      has_more: hasMore,
    };
  });
}

/**
 * 指定されたセッションを取得する
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param sessionId - セッションID
 * @returns セッション情報（見つからない場合は null）
 */
export async function getSession(
  fastify: FastifyInstance,
  userId: string,
  sessionId: string
): Promise<SessionResponse | null> {
  return fastify.withUserContext(userId, async tx => {
    const rows = await tx
      .select({
        id: sessions.id,
        title: sessions.title,
        status: sessions.status,
        context: sessions.context,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      title: row.title,
      session_status: row.status as SessionStatus,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
      session_context: (row.context as SessionContextResponse) ?? null,
    };
  });
}
