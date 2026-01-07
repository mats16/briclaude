// apps/backend/src/db/helpers.ts
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, eq } from 'drizzle-orm';
import * as schema from './schema.js';
import { sessionEvents, type InsertSessionEvent } from './schema.js';

/**
 * session_events テーブルにレコードを挿入するヘルパー関数
 *
 * seq フィールドは自動的に計算されます（session_id ごとに自動インクリメント）。
 * トランザクション内で実行されるため、競合を防ぎます。
 *
 * @param db - Drizzle データベースインスタンス
 * @param event - 挿入するイベント（seq は省略可能）
 * @returns 挿入されたレコード
 */
export async function insertSessionEvent(
  db: PostgresJsDatabase<typeof schema>,
  event: Omit<InsertSessionEvent, 'seq'> & { seq?: number }
) {
  return db.transaction(async tx => {
    // seq が指定されている場合はそのまま使用
    if (event.seq !== undefined && event.seq !== 0) {
      const [inserted] = await tx
        .insert(sessionEvents)
        .values(event as InsertSessionEvent)
        .returning();
      return inserted;
    }

    // seq が指定されていない場合は自動計算
    const result = await tx
      .select({ maxSeq: sql<number>`COALESCE(MAX(${sessionEvents.seq}), 0)` })
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, event.sessionId));

    const nextSeq = (result[0]?.maxSeq ?? 0) + 1;

    const [inserted] = await tx
      .insert(sessionEvents)
      .values({
        ...event,
        seq: nextSeq,
      })
      .returning();

    return inserted;
  });
}
