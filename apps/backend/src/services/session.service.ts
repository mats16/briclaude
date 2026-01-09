import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { typeid } from 'typeid-js';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { requestContext } from '@fastify/request-context';
import type {
  SessionCreateRequest,
  SessionCreateResponse,
  SessionContextResponse,
  SessionCreateEvent,
  SessionEventData,
} from '@repo/types';
import { sessions } from '../db/schema.js';
import { insertSessionEventInTx } from '../db/helpers.js';
import { wsManager } from './websocket-manager.service.js';

/**
 * イベントを WebSocket にブロードキャストし、DB に保存する（並列処理）
 * WebSocket 送信は即座に行い、DB 書き込みは待たない
 */
function saveAndBroadcastEvent(
  fastify: FastifyInstance,
  userId: string,
  sessionId: string,
  message: SDKMessage
): void {
  const eventUuid = 'uuid' in message ? (message.uuid as string) : crypto.randomUUID();
  const eventSubtype = 'subtype' in message ? (message.subtype as string | undefined) : undefined;

  // WebSocket にブロードキャスト（即座に送信）
  const event: SessionEventData = {
    uuid: eventUuid,
    type: message.type,
    subtype: eventSubtype,
    data: message,
  };
  wsManager.broadcastEvent(sessionId, event);

  // DB に保存（バックグラウンドで実行、待たない）
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

/**
 * init イベントを待機する
 * init イベント受信までのすべてのイベントを DB 保存 & WebSocket 送信
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
  userEvents: SessionCreateEvent[]
): Promise<WaitForInitResult> {
  const iterator = response[Symbol.asyncIterator]();

  while (true) {
    const { value: message, done } = await iterator.next();

    if (done || !message) {
      throw new Error('Stream ended before init event');
    }

    // WebSocket 送信 & DB 保存（並列）
    saveAndBroadcastEvent(fastify, userId, sessionId, message);

    // init イベントを検出
    if (message.type === 'system' && message.subtype === 'init') {
      const sdkSessionId = message.session_id;

      // sessions の status と sdk_session_id を更新 + ユーザーイベント挿入
      await fastify.withUserContext(userId, async tx => {
        await tx
          .update(sessions)
          .set({
            status: 'running',
            sdkSessionId: sdkSessionId || null,
          })
          .where(eq(sessions.id, sessionId));

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
 * 2. sessions テーブルに status='init' でレコード挿入
 * 3. claude-agent-sdk で query() 実行
 * 4. init イベント受信時に status を 'running' に更新し、sdk_session_id を設定
 * 5. 即座にレスポンスを返し、残りのイベントはバックグラウンドで処理
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

  // 5. sessions テーブルに status='init' でレコード挿入（SDK呼び出し前）
  let createdAt: Date = new Date();
  let updatedAt: Date = new Date();

  await fastify.withUserContext(userId, async tx => {
    const now = new Date();
    createdAt = now;
    updatedAt = now;

    await tx.insert(sessions).values({
      id: sessionId,
      userId,
      title: title ?? null,
      status: 'init', // SDK呼び出し前なので init
      sdkSessionId: null, // SDK呼び出し前なので null
      context: sessionContext,
    });
  });

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

    // 7. init イベントまで待機
    const { iterator } = await waitForInit(response, fastify, userId, sessionId, events);

    // 8. バックグラウンド処理開始（await しない）
    processRemainingEvents(iterator, fastify, userId, sessionId).catch(error => {
      fastify.log.error({ sessionId, error }, 'Background event processing failed');
    });
  } catch (error) {
    // SDK呼び出し失敗時: status は 'init' のまま残る
    // 後でクリーンアップジョブで処理可能
    fastify.log.error({ sessionId, error }, 'SDK query failed');
    throw error;
  }

  // 9. ユーザーイベントを SessionEventData 形式に変換
  const initialEvents: SessionEventData[] = events.map(event => ({
    uuid: event.data.uuid,
    type: event.data.type,
    subtype: undefined,
    data: {
      type: event.data.type,
      message: event.data.message,
    } as SessionEventData['data'],
  }));

  // 10. 即座にレスポンス返却
  return {
    id: sessionId,
    session_status: 'running',
    title: title ?? null,
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
    session_context: sessionContext,
    initial_events: initialEvents,
  };
}
