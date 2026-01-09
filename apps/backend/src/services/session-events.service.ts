import type { FastifyInstance } from 'fastify';
import { eq, gt, and, asc, desc } from 'drizzle-orm';
import type { SessionEventsResponse, SessionEventData } from '@repo/types';
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
  options: { after?: number; limit?: number } = {}
): Promise<SessionEventsResponse> {
  const { after = 0, limit = 100 } = options;
  const safeLimit = Math.min(Math.max(1, limit), 1000);

  return fastify.withUserContext(userId, async tx => {
    // セッションの存在確認（RLS でユーザー所有確認も兼ねる）
    const [session] = await tx.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId));

    if (!session) {
      throw new Error('Session not found');
    }

    // イベント取得（seq の昇順）
    const events = await tx
      .select({
        seq: sessionEvents.seq,
        uuid: sessionEvents.uuid,
        type: sessionEvents.type,
        subtype: sessionEvents.subtype,
        message: sessionEvents.message,
        createdAt: sessionEvents.createdAt,
      })
      .from(sessionEvents)
      .where(and(eq(sessionEvents.sessionId, sessionId), gt(sessionEvents.seq, after)))
      .orderBy(asc(sessionEvents.seq))
      .limit(safeLimit + 1); // +1 で has_more 判定

    const hasMore = events.length > safeLimit;
    const resultEvents = hasMore ? events.slice(0, safeLimit) : events;

    const data: SessionEventData[] = resultEvents.map(e => ({
      seq: e.seq,
      uuid: e.uuid,
      type: e.type,
      subtype: e.subtype,
      message: e.message,
      created_at: e.createdAt.toISOString(),
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
    const [session] = await tx.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId));

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
