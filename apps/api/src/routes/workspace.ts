import { FastifyPluginAsync } from 'fastify';
import proxy from '@fastify/http-proxy';

const workspaceRoute: FastifyPluginAsync = async fastify => {
  await fastify.register(proxy, {
    upstream: `https://${fastify.config.DATABRICKS_HOST}`,
    prefix: '/workspace',
    rewritePrefix: '/api/2.0/workspace',
    replyOptions: {
      rewriteRequestHeaders: (_req, headers) => {
        const oboToken = _req.ctx?.user.oboAccessToken;
        return {
          ...headers,
          authorization: oboToken ? `Bearer ${oboToken}` : '',
        };
      },
    },
  });
};

export default workspaceRoute;
