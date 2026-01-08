import type { FastifyInstance } from 'fastify';
import type { UserInfo } from '@repo/types';
import { eq, sql } from 'drizzle-orm';
import { users, userSettings } from '../db/schema.js';

/**
 * ユーザーを取得または作成する
 *
 * users テーブルはRLS無効、user_settings はRLS有効。
 * 両方を同一トランザクションで作成するため、
 * トランザクション内でセッション変数を設定してからINSERTする。
 *
 * @param fastify - Fastify インスタンス
 * @param userInfo - リクエストから取得したユーザー情報
 * @returns UserInfo
 */
export async function getOrCreateUser(
  fastify: FastifyInstance,
  userInfo: UserInfo
): Promise<UserInfo> {
  const { id, name, email } = userInfo;

  // 既存ユーザーチェック
  const [existingUser] = await fastify.db.select().from(users).where(eq(users.id, id)).limit(1);

  if (existingUser) {
    return { id, name, email };
  }

  // 新規ユーザー作成（users + user_settings を同一トランザクションで）
  await fastify.db.transaction(async tx => {
    // RLSコンテキスト設定（user_settings INSERT用）
    await tx.execute(sql`SELECT set_config('app.user_id', ${id}, true)`);

    // users テーブルに挿入
    await tx.insert(users).values({ id }).onConflictDoNothing();

    // user_settings テーブルに挿入（デフォルト値使用）
    await tx.insert(userSettings).values({ userId: id }).onConflictDoNothing();
  });

  return { id, name, email };
}
