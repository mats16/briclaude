import type { FastifyInstance } from 'fastify';
import { typeid } from 'typeid-js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SessionStartRequest } from '@repo/types';
import { sessions } from '../db/schema.js';
import { insertSessionEventInTx } from '../db/helpers.js';

export interface CreateSessionResult {
  sessionId: string;
  sdkSessionId: string;
}

/**
 * 新規セッションを作成する
 *
 * 処理フロー:
 * 1. TypeID で session_id 生成
 * 2. claude-agent-sdk で query() 実行し、init イベントから sdk_session_id 取得
 * 3. 単一トランザクション内でセッションとイベントを保存
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID
 * @param request - セッション開始リクエスト
 * @returns セッションIDとSDKセッションID
 */
export async function createSession(
  fastify: FastifyInstance,
  userId: string,
  request: SessionStartRequest
): Promise<CreateSessionResult> {
  const { events, session_context } = request;

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

  // 3. ユーザーメッセージのテキストを抽出
  const userContent = events[0]?.message.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');

  // 4. claude-agent-sdk で query 実行し、init イベントから sdk_session_id 取得
  let sdkSessionId = '';
  const response = query({
    prompt: userContent,
    options: {
      model: modelName,
    },
  });

  for await (const message of response) {
    if (message.type === 'system' && message.subtype === 'init') {
      sdkSessionId = message.session_id;
      break;
    }
  }

  // 5. 単一トランザクション内でセッションとイベントを保存
  // セッション保存とイベント保存が同一トランザクション内で実行されるため、
  // どちらかが失敗した場合は両方ロールバックされる
  await fastify.withUserContext(userId, async tx => {
    // セッションを sessions テーブルに保存
    await tx.insert(sessions).values({
      id: sessionId,
      userId,
      title: null,
      sdkSessionId: sdkSessionId || null,
      databricksWorkspacePath: session_context.databricksWorkspacePath,
      databricksWorkspaceAutoPush: session_context.databricksWorkspaceAutoPush,
    });

    // イベントを session_events テーブルに保存
    for (const event of events) {
      await insertSessionEventInTx(tx, {
        uuid: event.uuid,
        sessionId,
        type: event.type,
        subtype: null,
        message: event.message,
      });
    }
  });

  return { sessionId, sdkSessionId };
}
