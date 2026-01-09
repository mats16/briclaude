// apps/backend/src/db/helpers.ts
import { sessionEvents } from './schema.js';
import type { RLSTransaction } from '../plugins/database.js';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * JSON シリアライズ可能なメッセージ型
 * claude-agent-sdk の SDKUserMessage.message と互換性あり
 */
export type SerializableMessage = SDKUserMessage['message'];

/**
 * insertSessionEvent の引数型
 */
export type InsertSessionEventInput = {
  uuid: string;
  sessionId: string;
  type: string;
  subtype: string | null;
  message: SerializableMessage;
};

/**
 * 既存のトランザクション内で session_events テーブルにレコードを挿入するヘルパー関数
 *
 * @param tx - 既存のトランザクションインスタンス
 * @param event - 挿入するイベント
 * @returns 挿入されたレコード
 */
export async function insertSessionEventInTx(tx: RLSTransaction, event: InsertSessionEventInput) {
  const [inserted] = await tx
    .insert(sessionEvents)
    .values({
      uuid: event.uuid,
      sessionId: event.sessionId,
      type: event.type,
      subtype: event.subtype,
      message: event.message,
    })
    .returning();

  return inserted;
}
