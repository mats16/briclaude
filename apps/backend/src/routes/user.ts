import { FastifyPluginAsync } from 'fastify';
import type { UserResponse, ApiError } from '@repo/types';
import { getOrCreateUser } from '../services/user.service.js';

const userRoute: FastifyPluginAsync = async fastify => {
  fastify.get<{ Reply: UserResponse | ApiError }>('/user', async (request, reply) => {
    const userId = request.ctx?.user.id;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const user = await getOrCreateUser(fastify, {
      id: userId,
      name: request.ctx?.user.name ?? '',
      email: request.ctx?.user.email ?? '',
    });

    return reply.send({ user });
  });
};

export default userRoute;
