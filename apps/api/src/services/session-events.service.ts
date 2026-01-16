import type { FastifyInstance } from 'fastify';
import { eq, gt, and, asc, desc } from 'drizzle-orm';
import type {
  SessionEventsResponse,
  SessionUsageResponse,
  ModelUsageInfo,
  SDKMessage,
} from '@repo/types';
import { sessionEvents, sessions } from '../db/schema.js';
import { SessionId } from '../models/session.model.js';

/**
 * SDK ModelUsage 型（camelCase）
 * @anthropic-ai/claude-agent-sdk から export されていないため、ここで定義
 */
interface SDKModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
  maxOutputTokens: number;
}

/**
 * SDK Result メッセージ型
 */
interface SDKResultMessage {
  type: 'result';
  subtype: string;
  uuid: string;
  session_id: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  modelUsage: Record<string, SDKModelUsage>;
}

/**
 * セッションのイベント一覧を取得
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID（RLS で使用）
 * @param sessionId - SessionId オブジェクト
 * @param options - 取得オプション
 * @returns セッションイベントレスポンス
 */
export async function listSessionEvents(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId,
  options: { after?: string; limit?: number } = {}
): Promise<SessionEventsResponse> {
  const { after, limit = 100 } = options;
  const safeLimit = Math.min(Math.max(1, limit), 1000);
  const sessionUuid = sessionId.toUUID();

  return fastify.withUserContext(userId, async tx => {
    // セッションの存在確認（RLS でユーザー所有確認も兼ねる）
    const [session] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionUuid));

    if (!session) {
      throw new Error('Session not found');
    }

    // after uuid から created_at を取得
    let afterCreatedAt: Date | null = null;
    if (after) {
      const [afterEvent] = await tx
        .select({ createdAt: sessionEvents.createdAt })
        .from(sessionEvents)
        .where(eq(sessionEvents.uuid, after));
      if (afterEvent) {
        afterCreatedAt = afterEvent.createdAt;
      }
    }

    // イベント取得（created_at の昇順）
    const events = await tx
      .select({
        uuid: sessionEvents.uuid,
        type: sessionEvents.type,
        subtype: sessionEvents.subtype,
        message: sessionEvents.message,
      })
      .from(sessionEvents)
      .where(
        afterCreatedAt
          ? and(
              eq(sessionEvents.sessionId, sessionUuid),
              gt(sessionEvents.createdAt, afterCreatedAt)
            )
          : eq(sessionEvents.sessionId, sessionUuid)
      )
      .orderBy(asc(sessionEvents.createdAt))
      .limit(safeLimit + 1); // +1 で has_more 判定

    const hasMore = events.length > safeLimit;
    const resultEvents = hasMore ? events.slice(0, safeLimit) : events;

    // DB から取得した message を SDKMessage としてそのまま返す
    const data: SDKMessage[] = resultEvents.map(e => e.message as SDKMessage);

    return {
      data,
      first_id: resultEvents.length > 0 ? resultEvents[0].uuid : '',
      last_id: resultEvents.length > 0 ? resultEvents[resultEvents.length - 1].uuid : '',
      has_more: hasMore,
    };
  });
}

/**
 * セッションの最新イベント UUID を取得
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID（RLS で使用）
 * @param sessionId - SessionId オブジェクト
 * @returns 最新のイベント UUID（イベントがない場合は null）
 */
export async function getSessionLastEventId(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId
): Promise<string | null> {
  const sessionUuid = sessionId.toUUID();

  return fastify.withUserContext(userId, async tx => {
    // セッションの存在確認（RLS でユーザー所有確認も兼ねる）
    const [session] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionUuid));

    if (!session) {
      throw new Error('Session not found');
    }

    const [result] = await tx
      .select({ uuid: sessionEvents.uuid })
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionUuid))
      .orderBy(desc(sessionEvents.createdAt))
      .limit(1);

    return result?.uuid ?? null;
  });
}

/**
 * SDKModelUsage (camelCase) を ModelUsageInfo (snake_case) に変換
 */
function convertModelUsage(sdkUsage: SDKModelUsage): ModelUsageInfo {
  return {
    input_tokens: sdkUsage.inputTokens,
    output_tokens: sdkUsage.outputTokens,
    cache_read_input_tokens: sdkUsage.cacheReadInputTokens,
    cache_creation_input_tokens: sdkUsage.cacheCreationInputTokens,
    web_search_requests: sdkUsage.webSearchRequests,
    cost_usd: sdkUsage.costUSD,
    context_window: sdkUsage.contextWindow,
    max_output_tokens: sdkUsage.maxOutputTokens,
  };
}

/**
 * セッションの使用量情報を取得（全 result イベントを合算）
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID（RLS で使用）
 * @param sessionId - SessionId オブジェクト
 * @returns セッション使用量レスポンス（result イベントがない場合は 0 で初期化）
 */
export async function getSessionUsage(
  fastify: FastifyInstance,
  userId: string,
  sessionId: SessionId
): Promise<SessionUsageResponse> {
  const sessionUuid = sessionId.toUUID();

  return fastify.withUserContext(userId, async tx => {
    // セッションの存在確認（RLS でユーザー所有確認も兼ねる）
    const [session] = await tx
      .select({ id: sessions.id, updatedAt: sessions.updatedAt })
      .from(sessions)
      .where(eq(sessions.id, sessionUuid));

    if (!session) {
      throw new Error('Session not found');
    }

    // 全ての result イベントを取得
    const resultEvents = await tx
      .select({
        message: sessionEvents.message,
        createdAt: sessionEvents.createdAt,
      })
      .from(sessionEvents)
      .where(and(eq(sessionEvents.sessionId, sessionUuid), eq(sessionEvents.type, 'result')))
      .orderBy(desc(sessionEvents.createdAt));

    // 合算用の変数を初期化
    let totalCostUsd = 0;
    const aggregatedModelUsage: Record<string, ModelUsageInfo> = {};
    let latestUpdatedAt = session.updatedAt;

    // 全ての result イベントを合算
    for (const resultEvent of resultEvents) {
      const resultMessage = resultEvent.message as SDKResultMessage;

      // total_cost_usd を合算
      totalCostUsd += resultMessage.total_cost_usd ?? 0;

      // modelUsage を合算
      if (resultMessage.modelUsage) {
        for (const [modelName, usage] of Object.entries(resultMessage.modelUsage)) {
          if (!aggregatedModelUsage[modelName]) {
            aggregatedModelUsage[modelName] = {
              input_tokens: 0,
              output_tokens: 0,
              cache_read_input_tokens: 0,
              cache_creation_input_tokens: 0,
              web_search_requests: 0,
              cost_usd: 0,
              context_window: usage.contextWindow,
              max_output_tokens: usage.maxOutputTokens,
            };
          }
          const converted = convertModelUsage(usage);
          aggregatedModelUsage[modelName].input_tokens += converted.input_tokens;
          aggregatedModelUsage[modelName].output_tokens += converted.output_tokens;
          aggregatedModelUsage[modelName].cache_read_input_tokens +=
            converted.cache_read_input_tokens;
          aggregatedModelUsage[modelName].cache_creation_input_tokens +=
            converted.cache_creation_input_tokens;
          aggregatedModelUsage[modelName].web_search_requests += converted.web_search_requests;
          aggregatedModelUsage[modelName].cost_usd += converted.cost_usd;
        }
      }

      // 最新の updated_at を保持
      if (resultEvent.createdAt > latestUpdatedAt) {
        latestUpdatedAt = resultEvent.createdAt;
      }
    }

    // total_input_tokens, total_output_tokens を計算
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    for (const usage of Object.values(aggregatedModelUsage)) {
      totalInputTokens += usage.input_tokens;
      totalOutputTokens += usage.output_tokens;
    }

    return {
      session_id: sessionId.toString(),
      total_cost_usd: totalCostUsd,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      model_usage: aggregatedModelUsage,
      updated_at: latestUpdatedAt.toISOString(),
    };
  });
}
