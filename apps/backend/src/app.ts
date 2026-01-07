import Fastify from 'fastify';
import configPlugin from './plugins/config.js';
import requestDecoratorPlugin from './plugins/request-decorator.js';
import staticPlugin from './plugins/static.js';
import healthRoute from './routes/health.js';

export async function build() {
  const app = Fastify({
    logger: true,
  });

  // 設定プラグイン（最初に登録）
  await app.register(configPlugin);

  // リクエストデコレータプラグイン
  await app.register(requestDecoratorPlugin);

  // ルート登録（静的ファイルより先に）
  await app.register(healthRoute, { prefix: '/api' });

  // 静的ファイル配信（最後に登録）
  await app.register(staticPlugin);

  return app;
}
