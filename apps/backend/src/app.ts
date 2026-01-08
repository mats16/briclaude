import Fastify from 'fastify';
import compress from '@fastify/compress';
import configPlugin from './plugins/config.js';
import databasePlugin from './plugins/database.js';
import requestDecoratorPlugin from './plugins/request-decorator.js';
import staticPlugin from './plugins/static.js';
import healthRoute from './routes/health.js';
import userRoute from './routes/user.js';

export async function build() {
  const app = Fastify({
    logger: true,
  });

  // 設定プラグイン（最初に登録）
  await app.register(configPlugin);

  // データベースプラグイン（configの後、他のプラグインの前）
  await app.register(databasePlugin);

  // リクエストデコレータプラグイン
  await app.register(requestDecoratorPlugin);

  // 圧縮プラグイン（brotli, gzip）
  await app.register(compress, {
    encodings: ['br', 'gzip', 'deflate'],
  });

  // ルート登録（静的ファイルより先に）
  await app.register(healthRoute, { prefix: '/api' });
  await app.register(userRoute, { prefix: '/api' });

  // APIルートのキャッシュ制御
  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  });

  // 静的ファイル配信（最後に登録）
  await app.register(staticPlugin);

  return app;
}
