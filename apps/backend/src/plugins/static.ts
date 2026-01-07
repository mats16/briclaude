import fp from 'fastify-plugin';
import staticPlugin from '@fastify/static';
import path from 'path';

const __dirname = import.meta.dirname;

// 正規表現を事前にコンパイル（パフォーマンス最適化）
const LONG_CACHE_PATTERN = /\.(js|css|woff2?|ttf|eot)$/;

export default fp(
  async fastify => {
    const frontendDistPath = path.join(__dirname, '../../../frontend/dist');

    // 静的ファイル配信を登録
    await fastify.register(staticPlugin, {
      root: frontendDistPath,
      prefix: '/',
      cacheControl: false, // デフォルトのキャッシュ制御を無効化
      setHeaders: (res, filePath) => {
        // JS/CSS/フォントファイルには長期キャッシュを設定（ハッシュ付きファイル名のため）
        if (LONG_CACHE_PATTERN.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // HTMLファイルと画像は短期キャッシュ
        else {
          res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        }
      },
    });

    // SPA fallback - すべての未知のルートでindex.htmlを返す
    fastify.setNotFoundHandler(async (request, reply) => {
      // APIルートの場合はJSONエラーを返す
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'Route not found',
          statusCode: 404,
        });
      }

      // SPA fallback
      try {
        return reply.sendFile('index.html');
      } catch (error: unknown) {
        // 型安全なエラーハンドリング
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        fastify.log.error({ error, errorMessage }, 'Failed to send index.html');
        return reply.status(500).send({
          error: 'InternalServerError',
          message: 'Failed to load application',
          statusCode: 500,
        });
      }
    });

    fastify.log.info({ path: frontendDistPath }, 'Static file serving registered');
  },
  { name: 'static' }
);
