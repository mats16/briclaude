// apps/backend/src/plugins/database.ts
import fp from 'fastify-plugin';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema.js';

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
