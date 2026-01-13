import { FastifyPluginAsync } from 'fastify';
import { createUserContext } from '../lib/user-context.js';

const workspaceRoute: FastifyPluginAsync = async fastify => {
  fastify.get<{
    Querystring: { path: string };
  }>('/workspace/list', async (request, reply) => {
    const ctx = createUserContext(fastify, request);
    const pat = await ctx.getPat();

    if (!pat) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'PAT is not registered',
        statusCode: 401,
      });
    }

    const url = new URL(
      '/api/2.0/workspace/list',
      `https://${fastify.config.DATABRICKS_HOST}`
    );
    url.searchParams.set('path', request.query.path);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
    });

    const data = await response.json();
    return reply.status(response.status).send(data);
  });
};

export default workspaceRoute;
