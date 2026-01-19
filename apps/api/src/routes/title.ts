import { FastifyPluginAsync } from 'fastify';
import type { GenerateTitleRequest, GenerateTitleResponse, ApiError } from '@repo/types';
import { TitleService } from '../services/title.service.js';
import { createUserContext } from '../lib/user-context.js';

const titleRoute: FastifyPluginAsync = async fastify => {
  const titleService = new TitleService({
    databricksHost: fastify.config.DATABRICKS_HOST,
    model: fastify.config.ANTHROPIC_DEFAULT_HAIKU_MODEL,
  });

  fastify.post<{
    Body: GenerateTitleRequest;
    Reply: GenerateTitleResponse | ApiError;
  }>('/generate_title', async (request, reply) => {
    const { first_session_message } = request.body;

    // Validation
    if (!first_session_message || typeof first_session_message !== 'string') {
      const error: ApiError = {
        error: 'ValidationError',
        message: 'first_session_message is required and must be a non-empty string',
        statusCode: 400,
      };
      return reply.status(400).send(error);
    }

    // PAT を優先的に取得、なければ SP トークンにフォールバック
    const ctx = createUserContext(fastify, request);
    const authProvider = await ctx.getAuthProvider();
    let accessToken: string;
    try {
      accessToken = await authProvider.getToken();
    } catch {
      const error: ApiError = {
        error: 'Unauthorized',
        message: 'Access token is required (PAT or Service Principal)',
        statusCode: 401,
      };
      return reply.status(401).send(error);
    }

    try {
      const title = await titleService.generateTitle({
        firstSessionMessage: first_session_message,
        accessToken,
      });

      return reply.send({ title });
    } catch (error) {
      fastify.log.error(error, 'Failed to generate title');

      const apiError: ApiError = {
        error: 'InternalServerError',
        message: 'Failed to generate title',
        statusCode: 500,
      };
      return reply.status(500).send(apiError);
    }
  });
};

export default titleRoute;
