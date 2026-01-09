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

    // after uuid から seq を取得
    let afterSeq = 0;
    if (after) {
      const [afterEvent] = await tx
        .select({ seq: sessionEvents.seq })
        .from(sessionEvents)
        .where(and(eq(sessionEvents.sessionId, sessionId), eq(sessionEvents.uuid, after)));
      if (afterEvent) {
        afterSeq = afterEvent.seq;
      }
    }

    // イベント取得（seq の昇順）
    const events = await tx
      .select({
        uuid: sessionEvents.uuid,
        type: sessionEvents.type,
        subtype: sessionEvents.subtype,
        message: sessionEvents.message,
      })
      .from(sessionEvents)
      .where(and(eq(sessionEvents.sessionId, sessionId), gt(sessionEvents.seq, afterSeq)))
      .orderBy(asc(sessionEvents.seq))
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
 * セッションの最新 seq を取得
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザーID（RLS で使用）
 * @param sessionId - セッションID
 * @returns 最新の seq 値（イベントがない場合は 0）
 */
export async function getSessionLastSeq(
  fastify: FastifyInstance,
  userId: string,
  sessionId: string
): Promise<number> {
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
      .select({ seq: sessionEvents.seq })
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId))
      .orderBy(desc(sessionEvents.seq))
      .limit(1);

    return result?.seq ?? 0;
  });
}
