import Fastify from 'fastify';
import compress from '@fastify/compress';
import configPlugin from './plugins/config.js';
import databasePlugin from './plugins/database.js';
import websocketPlugin from './plugins/websocket.js';
import requestDecoratorPlugin from './plugins/request-decorator.js';
import staticPlugin from './plugins/static.js';
import healthRoute from './routes/health.js';
import userRoute from './routes/user.js';
import userTokensRoute from './routes/user-tokens.js';
import sessionRoute from './routes/session.js';
import titleRoute from './routes/title.js';
import workspaceRoute from './routes/workspace.js';
import reposRoute from './routes/repos.js';
import jobsRoute from './routes/jobs.js';
import userSkillsRoute from './routes/user-skills.js';
import userAgentsRoute from './routes/user-agents.js';
import sessionAppRoute from './routes/session-app.js';
import { startEventBatcher } from './services/event-queue.service.js';

export async function build() {
  const app = Fastify({
    logger: true,
  });

  // 設定プラグイン（最初に登録）
  await app.register(configPlugin);

  // データベースプラグイン（configの後、他のプラグインの前）
  await app.register(databasePlugin);

  // イベントバッチャー（databaseの後）
  await startEventBatcher(app);

  // WebSocket プラグイン
  await app.register(websocketPlugin);

  // リクエストデコレータプラグイン
  await app.register(requestDecoratorPlugin);

  // 圧縮プラグイン（brotli, gzip）
  await app.register(compress, {
    encodings: ['br', 'gzip', 'deflate'],
  });

  // ルート登録（静的ファイルより先に）
  await app.register(healthRoute, { prefix: '/api' });
  await app.register(userRoute, { prefix: '/api' });
  await app.register(userTokensRoute, { prefix: '/api' });
  await app.register(sessionRoute, { prefix: '/api' });
  await app.register(sessionAppRoute, { prefix: '/api' });
  await app.register(titleRoute, { prefix: '/api' });
  await app.register(workspaceRoute, { prefix: '/api/databricks' });
  await app.register(reposRoute, { prefix: '/api/databricks' });
  await app.register(jobsRoute, { prefix: '/api/databricks' });
  await app.register(userSkillsRoute, { prefix: '/api' });
  await app.register(userAgentsRoute, { prefix: '/api' });

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
