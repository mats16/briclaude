// apps/backend/src/db/helpers.ts
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, eq } from 'drizzle-orm';
import * as schema from './schema.js';
import { sessionEvents, type InsertSessionEvent } from './schema.js';

/**
 * insertSessionEvent の引数型
 * seq は省略可能（自動計算される）
 */
export type InsertSessionEventInput = Omit<InsertSessionEvent, 'seq' | 'message'> & {
  seq?: number;
  message: Record<string, unknown>;
};

/**
 * session_events テーブルにレコードを挿入するヘルパー関数
 *
 * seq フィールドは自動的に計算されます（session_id ごとに自動インクリメント）。
 * PostgreSQL の Advisory Lock を使用して、軽量かつ効率的に競合を防ぎます。
 *
 * @param db - Drizzle データベースインスタンス
 * @param event - 挿入するイベント（seq は省略可能）
 * @returns 挿入されたレコード
 */
export async function insertSessionEvent(
  db: PostgresJsDatabase<typeof schema>,
  event: InsertSessionEventInput
) {
  return db.transaction(async tx => {
    // seq が指定されている場合はそのまま使用
    if (event.seq !== undefined && event.seq !== 0) {
      const [inserted] = await tx
        .insert(sessionEvents)
        .values({
          uuid: event.uuid,
          sessionId: event.sessionId,
          seq: event.seq,
          type: event.type,
          subtype: event.subtype,
          message: event.message,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        })
        .returning();
      return inserted;
    }

    // Advisory Lock を取得（session_id ごとにロック）
    // pg_advisory_xact_lock はトランザクション終了時に自動解除
    // hashtext で文字列を整数に変換してロックキーとして使用
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${event.sessionId}))`);

    // seq を MAX+1 で計算
    const result = await tx
      .select({ maxSeq: sql<number>`COALESCE(MAX(${sessionEvents.seq}), 0)` })
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, event.sessionId));

    const nextSeq = (result[0]?.maxSeq ?? 0) + 1;

    // イベントを挿入
    const [inserted] = await tx
      .insert(sessionEvents)
      .values({
        uuid: event.uuid,
        sessionId: event.sessionId,
        seq: nextSeq,
        type: event.type,
        subtype: event.subtype,
        message: event.message,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      })
      .returning();

    return inserted;
  });
}
