// apps/api/src/db/helpers.ts
import { sessionEvents, type SessionEvent } from './schema.js';
import type { RLSTransaction } from '../plugins/database.js';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * JSON シリアライズ可能なメッセージ型
 * claude-agent-sdk の SDKMessage 全体を保存
 */
export type SerializableMessage = SDKMessage;

/**
 * insertSessionEvent の引数型
 */
export type InsertSessionEventInput = {
  uuid: string;
  /** セッションID（UUID 形式） */
  sessionId: string;
  type: string;
  subtype: string | null;
  message: SerializableMessage;
  /** 明示的な作成日時（省略時は DB の now() を使用） */
  createdAt?: Date;
};

/**
 * 既存のトランザクション内で session_events テーブルにレコードを挿入するヘルパー関数
 *
 * @param tx - 既存のトランザクションインスタンス
 * @param event - 挿入するイベント
 * @param options.idempotent - true の場合 ON CONFLICT DO NOTHING で冪等に挿入（リトライ用）
 * @returns 挿入されたレコード（idempotent 時に既存レコードがあれば null）
 */
export async function insertSessionEventInTx(
  tx: RLSTransaction,
  event: InsertSessionEventInput,
  options?: { idempotent?: boolean }
): Promise<SessionEvent | null> {
  const values = {
    uuid: event.uuid,
    sessionId: event.sessionId,
    type: event.type,
    subtype: event.subtype,
    message: event.message,
    ...(event.createdAt != null && { createdAt: event.createdAt }),
  };

  const query = options?.idempotent
    ? tx.insert(sessionEvents).values(values).onConflictDoNothing({ target: sessionEvents.uuid })
    : tx.insert(sessionEvents).values(values);

  const [inserted] = await query.returning();

  return inserted ?? null;
}
