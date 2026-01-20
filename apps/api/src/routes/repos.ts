import { FastifyPluginAsync } from 'fastify';
import type { ReposCreateRequest, ReposCreateResponse, ApiError } from '@repo/types';
import { createUserContext } from '../lib/user-context.js';

const reposRoute: FastifyPluginAsync = async fastify => {
  const databricksHost = fastify.config.DATABRICKS_HOST;

  // POST /repos - Create a repo
  fastify.post<{
    Body: ReposCreateRequest;
    Reply: ReposCreateResponse | ApiError;
  }>('/repos', async (request, reply) => {
    const { url, provider, path, sparse_checkout } = request.body;

    if (!url || url.trim() === '') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'url is required',
        statusCode: 400,
      });
    }

    if (!provider || provider.trim() === '') {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'provider is required',
        statusCode: 400,
      });
    }

    const ctx = createUserContext(fastify, request);
    const authProvider = await ctx.getAuthProvider();

    if (authProvider.type !== 'pat') {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'PAT is not registered',
        statusCode: 401,
      });
    }

    const pat = await authProvider.getToken();

    const apiUrl = new URL('/api/2.0/repos', `https://${databricksHost}`);

    const body: ReposCreateRequest = { url, provider };
    if (path) body.path = path;
    if (sparse_checkout) body.sparse_checkout = sparse_checkout;

    const response = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${pat}`,
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as ReposCreateResponse | ApiError;
    return reply.status(response.status).send(data);
  });
};

export default reposRoute;
