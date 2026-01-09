import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { typeid } from 'typeid-js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  SessionCreateRequest,
  SessionCreateResponse,
  SessionContextResponse,
} from '@repo/types';
import { sessions } from '../db/schema.js';
import { insertSessionEventInTx } from '../db/helpers.js';

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

  // 2. モデル名のマッピング
  const modelMap: Record<string, string> = {
    opus: fastify.config.ANTHROPIC_DEFAULT_OPUS_MODEL,
    sonnet: fastify.config.ANTHROPIC_DEFAULT_SONNET_MODEL,
    haiku: fastify.config.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  };
  const modelName =
    modelMap[session_context.model] || fastify.config.ANTHROPIC_DEFAULT_SONNET_MODEL;

  // 3. ユーザーメッセージのテキストを抽出（新形式）
  const userContent = events[0]?.data.message.content ?? '';

  // 4. cwd の生成（SESSION_BASE_DIR + sessionId の末尾部分）
  const sessionIdSuffix = sessionId.replace('session_', '');
  const cwd = `${fastify.config.SESSION_BASE_DIR}/${sessionIdSuffix}`;

  // 5. context オブジェクトの構築
  const sessionContext: SessionContextResponse = {
    allowed_tools: [],
    disallowed_tools: [],
    cwd,
    model: modelName,
    sources: session_context.sources,
    outcomes: session_context.outcomes,
  };

  // 6. sessions テーブルに status='init' でレコード挿入（SDK呼び出し前）
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

  // 7. claude-agent-sdk で query 実行
  let sdkSessionId = '';

  try {
    const response = query({
      prompt: userContent,
      options: {
        model: modelName,
      },
    });

    for await (const message of response) {
      if (message.type === 'system' && message.subtype === 'init') {
        sdkSessionId = message.session_id;

        // 8. init イベント受信時に status を 'running' に更新 + イベント挿入
        await fastify.withUserContext(userId, async tx => {
          // sessions の status と sdk_session_id を更新
          await tx
            .update(sessions)
            .set({
              status: 'running',
              sdkSessionId: sdkSessionId || null,
            })
            .where(eq(sessions.id, sessionId));

          // イベントを session_events テーブルに保存
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

        break;
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
