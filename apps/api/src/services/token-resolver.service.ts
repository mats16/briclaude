// apps/api/src/services/token-resolver.service.ts
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { oauthTokens } from '../db/schema.js';
import {
  getServicePrincipalToken as getSpToken,
  clearSpTokenCache,
} from '../utils/databricks-auth.js';

/**
 * キャッシュされたService Principalトークンを取得
 * 有効期限が切れている場合は再取得
 *
 * Note: 実装は utils/databricks-auth.ts に委譲しています
 */
export async function getServicePrincipalToken(
  fastify: FastifyInstance
): Promise<string | undefined> {
  const { DATABRICKS_HOST, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET } = fastify.config;

  try {
    return await getSpToken(DATABRICKS_HOST, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET);
  } catch (error) {
    fastify.log.error(error, 'Failed to get Service Principal token');
    return undefined;
  }
}

/**
 * DBからユーザーのPATを取得
 */
export async function getUserPAT(
  fastify: FastifyInstance,
  userId: string
): Promise<string | undefined> {
  if (!userId) return undefined;

  try {
    const tokens = await fastify.withUserContext(userId, async tx => {
      return tx
        .select()
        .from(oauthTokens)
        .where(
          and(
            eq(oauthTokens.userId, userId),
            eq(oauthTokens.provider, 'databricks'),
            eq(oauthTokens.authType, 'pat')
          )
        )
        .limit(1);
    });

    return tokens[0]?.accessToken ?? undefined;
  } catch (error) {
    fastify.log.warn({ userId, error }, 'Failed to fetch PAT from database');
  }

  return undefined;
}

/**
 * Service Principalトークンキャッシュをクリア（テスト用）
 *
 * Note: 実装は utils/databricks-auth.ts に委譲しています
 */
export function clearTokenCache(): void {
  clearSpTokenCache();
}
