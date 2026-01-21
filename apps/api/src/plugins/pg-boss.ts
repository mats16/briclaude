import fp from 'fastify-plugin';
import { PgBoss } from 'pg-boss';

declare module 'fastify' {
  interface FastifyInstance {
    boss: PgBoss;
  }
}

/**
 * pg-boss Plugin
 *
 * ジョブキューを初期化し、`fastify.boss` としてアクセス可能にします。
 *
 * リトライ設定やジョブ有効期限はジョブ送信時に個別に指定します。
 *
 * 依存関係:
 * - config: DATABASE_URL を取得するため
 */
export default fp(
  async fastify => {
    try {
      const boss = new PgBoss({
        connectionString: fastify.config.DATABASE_URL,
      });

      // pg-boss エラーハンドリング
      boss.on('error', (error: Error) => {
        fastify.log.error({ error }, 'pg-boss error');
      });

      // pg-boss 起動
      await boss.start();
      fastify.log.info('pg-boss started');

      // Fastify インスタンスにデコレート
      fastify.decorate('boss', boss);

      // Graceful shutdown
      // work() メソッドで登録されたワーカーは boss.stop() で自動停止される
      fastify.addHook('onClose', async () => {
        fastify.log.info('Stopping pg-boss...');
        await boss.stop({ graceful: true, timeout: 30000 });
        fastify.log.info('pg-boss stopped');
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error({ message }, 'Failed to initialize pg-boss');
      throw error;
    }
  },
  {
    name: 'pg-boss',
    dependencies: ['config'],
  }
);
