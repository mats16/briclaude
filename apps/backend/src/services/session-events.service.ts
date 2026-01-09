import type { FastifyInstance } from 'fastify';
import { eq, gt, and, asc, desc } from 'drizzle-orm';
import type { SessionEventsResponse, SessionEventData, SDKMessage } from '@repo/types';
import { sessionEvents, sessions } from '../db/schema.js';

/**
 * セッションのイベント一覧を取得
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID（RLS で使用）
 * @param sessionId - セッションID
 * @param options - 取得オプション
 * @returns セッションイベントレスポンス
 */
export async function getSessionEvents(
  fastify: FastifyInstance,
  userId: string,
  sessionId: string,
  options: { after?: string; limit?: number } = {}
): Promise<SessionEventsResponse> {
  const { after, limit = 100 } = options;
  const safeLimit = Math.min(Math.max(1, limit), 1000);

  return fastify.withUserContext(userId, async tx => {
    // セッションの存在確認（RLS でユーザー所有確認も兼ねる）
    const [session] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId));

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
          ? and(eq(sessionEvents.sessionId, sessionId), gt(sessionEvents.createdAt, afterCreatedAt))
          : eq(sessionEvents.sessionId, sessionId)
      )
      .orderBy(asc(sessionEvents.createdAt))
      .limit(safeLimit + 1); // +1 で has_more 判定

    const hasMore = events.length > safeLimit;
    const resultEvents = hasMore ? events.slice(0, safeLimit) : events;

    const data: SessionEventData[] = resultEvents.map(e => ({
      uuid: e.uuid,
      type: e.type,
      subtype: e.subtype ?? undefined,
      data: e.message as SDKMessage,
    }));

    return {
      data,
      first_id: data.length > 0 ? data[0].uuid : '',
      last_id: data.length > 0 ? data[data.length - 1].uuid : '',
      has_more: hasMore,
    };
  });
}

/**
 * セッションの最新イベント UUID を取得
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID（RLS で使用）
 * @param sessionId - セッションID
 * @returns 最新のイベント UUID（イベントがない場合は null）
 */
export async function getSessionLastEventId(
  fastify: FastifyInstance,
  userId: string,
  sessionId: string
): Promise<string | null> {
  return fastify.withUserContext(userId, async tx => {
    // セッションの存在確認（RLS でユーザー所有確認も兼ねる）
    const [session] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!session) {
      throw new Error('Session not found');
    }

    const [result] = await tx
      .select({ uuid: sessionEvents.uuid })
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId))
      .orderBy(desc(sessionEvents.createdAt))
      .limit(1);

    return result?.uuid ?? null;
  });
}
