// apps/backend/src/routes/session.ts
import { FastifyPluginAsync } from 'fastify';
import type { SessionStartRequest, SessionStartResponse, ApiError } from '@repo/types';
import { createSession } from '../services/session.service.js';

const sessionRoute: FastifyPluginAsync = async fastify => {
  fastify.post<{
    Body: SessionStartRequest;
    Reply: SessionStartResponse | ApiError;
  }>('/sessions', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const { events } = request.body;

    if (!events || events.length === 0) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'At least one event is required',
        statusCode: 400,
      });
    }

    try {
      const result = await createSession(fastify, user.id, request.body);
      return reply.status(201).send({
        session_id: result.sessionId,
      });
    } catch (error) {
      request.log.error(error, 'Failed to create session');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to create session',
        statusCode: 500,
      });
    }
  });
};

export default sessionRoute;
