import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { typeid } from 'typeid-js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { requestContext } from '@fastify/request-context';
import type {
  SessionCreateRequest,
  SessionCreateResponse,
  SessionContextResponse,
  WsSessionEvent,
} from '@repo/types';
import { sessions } from '../db/schema.js';
import { insertSessionEventInTx } from '../db/helpers.js';
import { wsManager } from './websocket-manager.service.js';

/**
 * 新規セッションを作成する
 *
 * 処理フロー:
 * 1. TypeID で session_id 生成
 * 2. sessions テーブルに status='init' でレコード挿入
 * 3. claude-agent-sdk で query() 実行
 * 4. init イベント受信時に status を 'running' に更新し、sdk_session_id を設定
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
  let sdkSessionId = '';
  let initProcessed = false;

  try {
    const response = query({
      prompt: userContent,
      options: {
        cwd: '.',
        model: session_context.model,
        settingSources: ['user', 'project', 'local'],
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
        }
      },
    });

    for await (const message of response) {
      // init イベント処理（1回のみ）
      if (message.type === 'system' && message.subtype === 'init' && !initProcessed) {
        sdkSessionId = message.session_id;
        initProcessed = true;

        // 7. init イベント受信時に status を 'running' に更新 + ユーザーイベント挿入
        await fastify.withUserContext(userId, async tx => {
          // sessions の status と sdk_session_id を更新
          await tx
            .update(sessions)
            .set({
              status: 'running',
              sdkSessionId: sdkSessionId || null,
            })
            .where(eq(sessions.id, sessionId));

          // ユーザーイベントを session_events テーブルに保存
          for (const event of events) {
            await insertSessionEventInTx(tx, {
              uuid: event.data.uuid,
              sessionId,
              type: event.data.type,
              subtype: null,
              message: event.data.message,
            });
          }
        });
      }

      // 8. 全イベントを DB に保存 & WebSocket にブロードキャスト
      const eventUuid = 'uuid' in message ? (message.uuid as string) : crypto.randomUUID();
      const eventSubtype = 'subtype' in message ? (message.subtype as string | null) : null;

      // イベントを session_events テーブルに保存
      const inserted = await fastify.withUserContext(userId, async tx => {
        return insertSessionEventInTx(tx, {
          uuid: eventUuid,
          sessionId,
          type: message.type,
          subtype: eventSubtype,
          message: message,
        });
      });

      // WebSocket にブロードキャスト
      const wsEvent: WsSessionEvent = {
        seq: inserted.seq,
        uuid: inserted.uuid,
        type: inserted.type,
        subtype: inserted.subtype,
        message: inserted.message,
        created_at: inserted.createdAt.toISOString(),
      };
      wsManager.broadcastEvent(sessionId, wsEvent);

      // result イベント時にセッション状態を idle に更新
      if (message.type === 'result') {
        await fastify.withUserContext(userId, async tx => {
          await tx.update(sessions).set({ status: 'idle' }).where(eq(sessions.id, sessionId));
        });
      }
    }
  } catch (error) {
    // SDK呼び出し失敗時: status は 'init' のまま残る
    // 後でクリーンアップジョブで処理可能
    fastify.log.error({ sessionId, error }, 'SDK query failed');
    throw error;
  }

  return {
    id: sessionId,
    session_status: 'running',
    title: title ?? null,
    created_at: createdAt.toISOString(),
    updated_at: updatedAt.toISOString(),
    session_context: sessionContext,
  };
}
