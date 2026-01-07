import Fastify from 'fastify';
import configPlugin from './plugins/config.js';
import healthRoute from './routes/health.js';

export async function build() {
  const app = Fastify({
    logger: true,
  });

  // 設定プラグイン（最初に登録）
  await app.register(configPlugin);

  // ルート登録
  await app.register(healthRoute, { prefix: '/api' });

  return app;
}
