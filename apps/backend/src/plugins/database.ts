// apps/backend/src/plugins/database.ts
import fp from 'fastify-plugin';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../db/schema.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Fastify型拡張
declare module 'fastify' {
  interface FastifyInstance {
    db: PostgresJsDatabase<typeof schema>;
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

      // マイグレーション実行（テスト環境ではスキップ）
      if (fastify.config.NODE_ENV !== 'test') {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const migrationsFolder = path.join(__dirname, '../../migrations');
        fastify.log.info({ migrationsFolder }, 'Running database migrations...');

        await migrate(db, { migrationsFolder });

        fastify.log.info('Database migrations completed');
      } else {
        fastify.log.info('Skipping database migrations in test environment');
      }

      // Fastifyインスタンスにデコレート
      fastify.decorate('db', db);

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
