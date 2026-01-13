// apps/api/src/services/token-resolver.service.ts
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { oauthTokens } from '../db/schema.js';

/**
 * Service Principal トークンのキャッシュ
 */
interface CachedToken {
  accessToken: string;
  expiresAt: Date;
}

// モジュールレベルでキャッシュを保持
let spTokenCache: CachedToken | null = null;

/**
 * Service Principal トークンを取得
 * OAuth 2.0 Client Credentials フロー
 */
async function fetchServicePrincipalToken(
  databricksHost: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch(`https://${databricksHost}/oidc/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'all-apis',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch SP token: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  // expires_in から有効期限を計算（5分のバッファを設ける）
  const expiresAt = new Date(Date.now() + (data.expires_in - 300) * 1000);

  // キャッシュを更新
  spTokenCache = {
    accessToken: data.access_token,
    expiresAt,
  };

  return data.access_token;
}

/**
 * キャッシュされたService Principalトークンを取得
 * 有効期限が切れている場合は再取得
 */
export async function getServicePrincipalToken(
  fastify: FastifyInstance
): Promise<string | undefined> {
  const { DATABRICKS_HOST, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET } = fastify.config;

  // 認証情報がない場合はundefined
  if (!DATABRICKS_CLIENT_ID || !DATABRICKS_CLIENT_SECRET) {
    return undefined;
  }

  // キャッシュが有効な場合はキャッシュから返す
  if (spTokenCache && spTokenCache.expiresAt > new Date()) {
    return spTokenCache.accessToken;
  }

  // 新しいトークンを取得
  try {
    return await fetchServicePrincipalToken(
      DATABRICKS_HOST,
      DATABRICKS_CLIENT_ID,
      DATABRICKS_CLIENT_SECRET
    );
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
 */
export function clearTokenCache(): void {
  spTokenCache = null;
}
