// apps/api/src/plugins/database.ts
import fp from 'fastify-plugin';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '../db/schema.js';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * RLS対応トランザクションの型
 * Drizzle ORM のトランザクション内で使用可能なDB操作
 */
export type RLSTransaction = Parameters<
  Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]
>[0];

/**
 * withUserContext のコールバック型
 */
export type WithUserContextCallback<T> = (tx: RLSTransaction) => Promise<T>;

/**
 * RLSコンテキスト設定エラー
 * ユーザーコンテキストの設定に失敗した場合にスローされる
 */
export class RLSContextError extends Error {
  constructor(
    message: string,
    public readonly userId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RLSContextError';
  }
}

// Fastify型拡張
declare module 'fastify' {
  interface FastifyInstance {
    db: PostgresJsDatabase<typeof schema>;
    /**
     * RLS対応のユーザーコンテキスト付きトランザクションを実行
     *
     * PostgreSQLセッション変数 `app.user_id` を設定し、
     * RLSポリシーによるデータ分離を有効にします。
     *
     * @param userId - ユーザーID（RLSポリシーで使用）
     * @param callback - トランザクション内で実行するコールバック
     * @returns コールバックの戻り値
     *
     * @example
     * ```typescript
     * const sessions = await fastify.withUserContext(userId, async (tx) => {
     *   return tx.select().from(sessions);
     * });
     * ```
     */
    withUserContext: <T>(userId: string, callback: WithUserContextCallback<T>) => Promise<T>;
  }
}

/**
 * Database Plugin
 *
 * Drizzle ORMとPostgreSQLクライアントを初期化し、
 * `fastify.db`としてアクセス可能にします。
 *
 * サーバー起動時に自動的にマイグレーションを実行します。
 * マイグレーションファイルは `migrations/` フォルダから読み込まれます。
 *
 * 依存関係:
 * - config: DATABASE_URLを取得するため
 */
export default fp(
  async fastify => {
    try {
      // PostgreSQLクライアント作成
      const client = postgres(fastify.config.DATABASE_URL, {
        max: 10, // 接続プールサイズ
        idle_timeout: 20, // アイドル接続タイムアウト（秒）
        connect_timeout: 10, // 接続タイムアウト（秒）
      });

      // Drizzle ORM初期化
      const db = drizzle({ client, schema });

      // マイグレーション実行（テスト環境または DISABLE_AUTO_MIGRATION=true ではスキップ）
      const shouldSkipMigration =
        fastify.config.NODE_ENV === 'test' || fastify.config.DISABLE_AUTO_MIGRATION;

      if (!shouldSkipMigration) {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const migrationsFolder = path.join(__dirname, '../../migrations');
        fastify.log.info({ migrationsFolder }, 'Running database migrations...');

        await migrate(db, { migrationsFolder });

        fastify.log.info('Database migrations completed');
      } else {
        const reason = fastify.config.DISABLE_AUTO_MIGRATION
          ? 'DISABLE_AUTO_MIGRATION is set'
          : 'test environment';
        fastify.log.info({ reason }, 'Skipping database migrations');
      }

      // Fastifyインスタンスにデコレート
      fastify.decorate('db', db);

      // RLS対応のユーザーコンテキスト付きトランザクションヘルパー
      fastify.decorate(
        'withUserContext',
        async <T>(userId: string, callback: WithUserContextCallback<T>): Promise<T> => {
          // userId のバリデーション
          if (!userId || typeof userId !== 'string') {
            throw new RLSContextError('Invalid userId: must be a non-empty string', userId ?? '');
          }

          if (userId.trim() === '') {
            throw new RLSContextError('Invalid userId: cannot be empty or whitespace only', userId);
          }

          return db.transaction(async tx => {
            try {
              // PostgreSQLセッション変数を設定（トランザクションスコープ）
              // set_config の第3引数 true = is_local（SET LOCAL と同等）
              // トランザクション終了時に自動的にリセットされる
              await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
            } catch (error) {
              throw new RLSContextError(
                `Failed to set RLS context for user: ${error instanceof Error ? error.message : 'Unknown error'}`,
                userId,
                error instanceof Error ? error : undefined
              );
            }

            // コールバックを実行
            return callback(tx);
          });
        }
      );

      fastify.log.info('Database connection established');

      // Graceful shutdown: onCloseフックでコネクションを閉じる
      fastify.addHook('onClose', async () => {
        fastify.log.info('Closing database connection...');
        await client.end();
        fastify.log.info('Database connection closed');
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error({ message }, 'Failed to initialize database connection');
      throw error;
    }
  },
  {
    name: 'db',
    dependencies: ['config'], // configプラグインに依存
  }
);
