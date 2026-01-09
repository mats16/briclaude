import type { FastifyInstance } from 'fastify';
import { eq, desc } from 'drizzle-orm';
import { typeid } from 'typeid-js';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { requestContext } from '@fastify/request-context';
import type {
  SessionCreateRequest,
  SessionCreateResponse,
  SessionContextResponse,
  SessionCreateEvent,
  SessionEventData,
  SessionListQuery,
  SessionListResponse,
  SessionSummary,
  SessionStatus,
} from '@repo/types';
import { sessions } from '../db/schema.js';
import { insertSessionEventInTx } from '../db/helpers.js';
import { wsManager } from './websocket-manager.service.js';

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

  // WebSocket にブロードキャスト（常に実行）
  const event: SessionEventData = {
    uuid: eventUuid,
    type: message.type,
    subtype: eventSubtype,
    data: message,
  };
  wsManager.broadcastEvent(sessionId, event);

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
 * init イベント受信まで WebSocket 送信のみ行い、DB 書き込みは init 受信時に一括で行う
 */
interface WaitForInitResult {
  sdkSessionId: string;
  iterator: AsyncIterator<SDKMessage, void>;
}

async function waitForInit(
  response: AsyncIterable<SDKMessage>,
  fastify: FastifyInstance,
  userId: string,
  sessionId: string,
  title: string | null,
  sessionContext: SessionContextResponse,
  userEvents: SessionCreateEvent[]
): Promise<WaitForInitResult> {
  const iterator = response[Symbol.asyncIterator]();
  const preInitEvents: SDKMessage[] = []; // init 前のイベントを一時保持

  while (true) {
    const { value: message, done } = await iterator.next();

    if (done || !message) {
      throw new Error('Stream ended before init event');
    }

    // init イベント前: WebSocket 送信のみ（DB 保存しない）
    saveAndBroadcastEvent(fastify, userId, sessionId, message, { skipDbSave: true });

    // init イベントを検出
    if (message.type === 'system' && message.subtype === 'init') {
      const sdkSessionId = message.session_id;

      // 1トランザクションで sessions INSERT + session_events INSERT
      await fastify.withUserContext(userId, async tx => {
        // sessions テーブルに INSERT
        await tx.insert(sessions).values({
          id: sessionId,
          userId,
          title,
          status: 'running',
          sdkSessionId: sdkSessionId || null,
          context: sessionContext,
        });

        // ユーザーイベントを session_events テーブルに保存
        for (const event of userEvents) {
          await insertSessionEventInTx(tx, {
            uuid: event.data.uuid,
            sessionId,
            type: event.data.type,
            subtype: null,
            message: event.data.message,
          });
        }

        // init 前のイベントを session_events テーブルに保存
        for (const preInitEvent of preInitEvents) {
          const eventUuid =
            'uuid' in preInitEvent ? (preInitEvent.uuid as string) : crypto.randomUUID();
          const eventSubtype =
            'subtype' in preInitEvent ? (preInitEvent.subtype as string | undefined) : undefined;
          await insertSessionEventInTx(tx, {
            uuid: eventUuid,
            sessionId,
            type: preInitEvent.type,
            subtype: eventSubtype ?? null,
            message: preInitEvent,
          });
        }

        // init イベント自体も session_events テーブルに保存
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

    // init 前のイベントを保持（後で DB に保存するため）
    preInitEvents.push(message);
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
 * 2. claude-agent-sdk で query() 実行
 * 3. init イベント受信時に sessions/session_events を 1 トランザクションで挿入
 * 4. 即座にレスポンスを返し、残りのイベントはバックグラウンドで処理
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
  const userContent = events[0]?.data.message.content ?? '';

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

  // 6. claude-agent-sdk で query 実行
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

    // 7. init イベントまで待機（sessions/session_events への挿入もここで行う）
    const { iterator } = await waitForInit(
      response,
      fastify,
      userId,
      sessionId,
      title ?? null,
      sessionContext,
      events
    );

    // 8. バックグラウンド処理開始（await しない）
    processRemainingEvents(iterator, fastify, userId, sessionId).catch(error => {
      fastify.log.error({ sessionId, error }, 'Background event processing failed');
    });
  } catch (error) {
    // SDK呼び出し失敗時: sessions/session_events には何も残らない（クリーン）
    fastify.log.error({ sessionId, error }, 'SDK query failed');
    throw error;
  }

  // 9. 即座にレスポンス返却
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

    // SessionSummary 形式に変換
    const data: SessionSummary[] = resultRows.map(row => ({
      id: row.id,
      title: row.title,
      session_status: row.status as SessionStatus,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }));

    return {
      data,
      first_id: data.length > 0 ? data[0].id : '',
      last_id: data.length > 0 ? data[data.length - 1].id : '',
      has_more: hasMore,
    };
  });
}
