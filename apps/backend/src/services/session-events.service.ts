import type { FastifyInstance } from 'fastify';
import { eq, gt, and, asc, desc } from 'drizzle-orm';
import type { SessionEventsResponse, SDKMessage } from '@repo/types';
import { sessionEvents, sessions } from '../db/schema.js';
import { SessionId } from '../models/session.model.js';

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
