import Fastify from 'fastify';
import cors from '@fastify/cors';
import configPlugin from './plugins/config.js';
import healthRoute from './routes/health.js';

export async function build() {
  const app = Fastify({
    logger: true,
  });

  // 設定プラグイン（最初に登録）
  await app.register(configPlugin);

  // CORS設定
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // ルート登録
  await app.register(healthRoute, { prefix: '/api' });

  return app;
}
