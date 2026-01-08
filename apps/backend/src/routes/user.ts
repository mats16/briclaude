import { FastifyPluginAsync } from 'fastify';
import type { UserResponse, ApiError } from '@repo/types';
import { getOrCreateUser } from '../services/user.service.js';

const userRoute: FastifyPluginAsync = async fastify => {
  fastify.get<{ Reply: UserResponse | ApiError }>('/user', async (request, reply) => {
    // preHandlerで必ず設定されるため、ctxは常に存在する
    const { user: requestUser } = request.ctx!;

    if (!requestUser.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const user = await getOrCreateUser(fastify, {
      id: requestUser.id,
      name: requestUser.name,
      email: requestUser.email,
    });

    return reply.send({ user });
  });
};

export default userRoute;
