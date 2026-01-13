import { FastifyPluginAsync } from 'fastify';
import type { UserResponse, ApiError } from '@repo/types';
import { eq } from 'drizzle-orm';
import { getOrCreateUser } from '../services/user.service.js';
import { oauthTokens } from '../db/schema.js';
import { maskToken } from './user-tokens.js';

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

    // トークン一覧を取得
    const rawTokens = await fastify.withUserContext(requestUser.id, async tx => {
      return tx.select().from(oauthTokens).where(eq(oauthTokens.userId, requestUser.id));
    });

    const tokens = rawTokens.map(t => ({
      provider: t.provider,
      auth_type: t.authType,
      masked_token: maskToken(t.accessToken),
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    }));

    return reply.send({
      user,
      databricks_host: fastify.config.DATABRICKS_HOST,
      tokens,
    });
  });
};

export default userRoute;
