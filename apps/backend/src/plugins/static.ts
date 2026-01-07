import fp from 'fastify-plugin';
import staticPlugin from '@fastify/static';
import path from 'path';

const __dirname = import.meta.dirname;

export default fp(
  async fastify => {
    const frontendDistPath = path.join(__dirname, '../../../frontend/dist');

    // 静的ファイル配信を登録
    await fastify.register(staticPlugin, {
      root: frontendDistPath,
      prefix: '/',
    });

    // SPA fallback - すべての未知のルートでindex.htmlを返す
    fastify.setNotFoundHandler((_request, reply) => {
      reply.sendFile('index.html');
    });

    fastify.log.info({ path: frontendDistPath }, 'Static file serving registered');
  },
  { name: 'static' }
);
