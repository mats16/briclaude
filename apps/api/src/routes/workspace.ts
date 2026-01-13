import { FastifyPluginAsync } from 'fastify';
import { createUserContext } from '../lib/user-context.js';

const workspaceRoute: FastifyPluginAsync = async fastify => {
  const databricksHost = fastify.config.DATABRICKS_HOST;

  // GET /workspace/list
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

    const url = new URL('/api/2.0/workspace/list', `https://${databricksHost}`);
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

  // GET /workspace/get-status
  fastify.get<{
    Querystring: { path: string };
  }>('/workspace/get-status', async (request, reply) => {
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
      '/api/2.0/workspace/get-status',
      `https://${databricksHost}`
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

  // POST /workspace/mkdirs
  fastify.post<{
    Body: { path: string };
  }>('/workspace/mkdirs', async (request, reply) => {
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
      '/api/2.0/workspace/mkdirs',
      `https://${databricksHost}`
    );

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
      body: JSON.stringify({ path: request.body.path }),
    });

    const data = await response.json();
    return reply.status(response.status).send(data);
  });
};

export default workspaceRoute;
