import { FastifyPluginAsync } from 'fastify';
import proxy from '@fastify/http-proxy';
import { createUserContext } from '../lib/user-context.js';

declare module 'fastify' {
  interface FastifyRequest {
    patToken?: string;
  }
}

const workspaceRoute: FastifyPluginAsync = async fastify => {
  // preHandler で PAT を取得してリクエストに保存
  fastify.addHook('preHandler', async request => {
    const ctx = createUserContext(fastify, request);
    const pat = await ctx.getPat();
    request.patToken = pat;
  });

  await fastify.register(proxy, {
    upstream: `https://${fastify.config.DATABRICKS_HOST}`,
    prefix: '/workspace',
    rewritePrefix: '/api/2.0/workspace',
    replyOptions: {
      rewriteRequestHeaders: req => {
        return {
          'content-type': 'application/json',
          authorization: req.patToken ? `Bearer ${req.patToken}` : '',
        };
      },
    },
  });
};

export default workspaceRoute;
