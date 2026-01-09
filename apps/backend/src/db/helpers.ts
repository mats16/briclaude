// apps/backend/src/db/helpers.ts
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, eq } from 'drizzle-orm';
import * as schema from './schema.js';
import { sessionEvents, type InsertSessionEvent } from './schema.js';
import type { RLSTransaction } from '../plugins/database.js';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * JSON シリアライズ可能なメッセージ型
 * claude-agent-sdk の SDKUserMessage.message と互換性あり
 */
export type SerializableMessage = SDKUserMessage['message'];

/**
 * insertSessionEvent の引数型
 * seq は自動計算されるため含まない
 */
export type InsertSessionEventInput = Omit<InsertSessionEvent, 'seq' | 'message'> & {
  message: SerializableMessage;
};

/**
 * session_events テーブルにレコードを挿入する内部実装
 *
 * seq フィールドは自動的に計算されます（session_id ごとに自動インクリメント）。
 * PostgreSQL の Advisory Lock を使用して、軽量かつ効率的に競合を防ぎます。
 *
 * @param tx - トランザクションインスタンス
 * @param event - 挿入するイベント
 * @returns 挿入されたレコード
 */
async function insertSessionEventImpl(tx: RLSTransaction, event: InsertSessionEventInput) {
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
}

/**
 * session_events テーブルにレコードを挿入するヘルパー関数
 *
 * @param db - Drizzle データベースインスタンス
 * @param event - 挿入するイベント
 * @returns 挿入されたレコード
 */
export async function insertSessionEvent(
  db: PostgresJsDatabase<typeof schema>,
  event: InsertSessionEventInput
) {
  return db.transaction(async tx => {
    return insertSessionEventImpl(tx, event);
  });
}

/**
 * 既存のトランザクション内で session_events テーブルにレコードを挿入するヘルパー関数
 *
 * 外部トランザクション内で使用する場合に使用します。
 * 新しいトランザクションを作成せず、渡されたトランザクションを使用します。
 *
 * @param tx - 既存のトランザクションインスタンス
 * @param event - 挿入するイベント
 * @returns 挿入されたレコード
 */
export async function insertSessionEventInTx(tx: RLSTransaction, event: InsertSessionEventInput) {
  return insertSessionEventImpl(tx, event);
}
