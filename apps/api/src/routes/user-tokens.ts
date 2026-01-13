import { FastifyPluginAsync } from 'fastify';
import type {
  RegisterTokenRequest,
  RegisterTokenResponse,
  TokenListResponse,
  DeleteTokenRequest,
  DeleteTokenResponse,
  ApiError,
} from '@repo/types';
import { oauthTokens } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

/**
 * トークンをマスク表示用に変換
 * 例: "dapi_abc123xyz" -> "dapi****xyz"
 */
export function maskToken(token: string): string {
  if (token.length <= 8) {
    return '****';
  }
  const prefix = token.slice(0, 4);
  const suffix = token.slice(-3);
  return `${prefix}****${suffix}`;
}

const userTokensRoute: FastifyPluginAsync = async fastify => {
  /**
   * POST /user/tokens
   * PAT を登録/更新（upsert）
   */
  fastify.post<{
    Body: RegisterTokenRequest;
    Reply: RegisterTokenResponse | ApiError;
  }>('/user/tokens', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const { provider, auth_type, token } = request.body;

    // バリデーション: Databricks プロバイダーのみサポート
    if (provider !== 'databricks') {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Only databricks provider is supported',
        statusCode: 400,
      });
    }

    // バリデーション: PAT 認証タイプのみサポート
    if (auth_type !== 'pat') {
      return reply.status(400).send({
        error: 'BadRequest',
        message: 'Only pat auth type is supported',
        statusCode: 400,
      });
    }

    // バリデーション: Databricks PAT 形式チェック
    if (!token || !token.startsWith('dapi')) {
      return reply.status(400).send({
        error: 'BadRequest',
        message: "Invalid Databricks PAT format. Token should start with 'dapi'",
        statusCode: 400,
      });
    }

    try {
      // RLS コンテキスト付きでトークンを upsert
      await fastify.withUserContext(user.id, async tx => {
        await tx
          .insert(oauthTokens)
          .values({
            userId: user.id,
            provider,
            authType: auth_type,
            accessToken: token, // encryptedText で自動暗号化
            refreshToken: null,
            expiresAt: null,
          })
          .onConflictDoUpdate({
            target: [oauthTokens.userId, oauthTokens.provider, oauthTokens.authType],
            set: {
              accessToken: token,
            },
          });
      });

      return reply.status(201).send({
        success: true,
        message: 'Token registered successfully',
      });
    } catch (error) {
      request.log.error(error, 'Failed to register token');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to register token',
        statusCode: 500,
      });
    }
  });

  /**
   * GET /user/tokens
   * 登録済みトークン一覧を取得（マスク表示）
   */
  fastify.get<{
    Reply: TokenListResponse | ApiError;
  }>('/user/tokens', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    try {
      const tokens = await fastify.withUserContext(user.id, async tx => {
        return tx.select().from(oauthTokens).where(eq(oauthTokens.userId, user.id));
      });

      const maskedTokens = tokens.map(t => ({
        provider: t.provider,
        auth_type: t.authType,
        masked_token: maskToken(t.accessToken),
        created_at: t.createdAt.toISOString(),
        updated_at: t.updatedAt.toISOString(),
      }));

      return reply.send({ tokens: maskedTokens });
    } catch (error) {
      request.log.error(error, 'Failed to fetch tokens');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to fetch tokens',
        statusCode: 500,
      });
    }
  });

  /**
   * DELETE /user/tokens
   * 指定されたトークンを削除
   */
  fastify.delete<{
    Body: DeleteTokenRequest;
    Reply: DeleteTokenResponse | ApiError;
  }>('/user/tokens', async (request, reply) => {
    const { user } = request.ctx!;

    if (!user.id) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User ID not found in request context',
        statusCode: 401,
      });
    }

    const { provider, auth_type } = request.body;

    try {
      await fastify.withUserContext(user.id, async tx => {
        await tx
          .delete(oauthTokens)
          .where(
            and(
              eq(oauthTokens.userId, user.id),
              eq(oauthTokens.provider, provider),
              eq(oauthTokens.authType, auth_type)
            )
          );
      });

      return reply.send({
        success: true,
        message: 'Token deleted successfully',
      });
    } catch (error) {
      request.log.error(error, 'Failed to delete token');
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to delete token',
        statusCode: 500,
      });
    }
  });
};

export default userTokensRoute;
