/**
 * Databricks 認証ユーティリティ
 *
 * Service Principal (SP) を使用した OAuth Client Credentials フローでトークンを取得します。
 * また、ユーザーの Personal Access Token (PAT) を DB から取得する機能も提供します。
 */

import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { oauthTokens } from '../db/schema.js';
import { normalizeHost } from '../utils/normalize-host.js';

interface CachedToken {
  accessToken: string;
  expiresAt: Date;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

/** Service Principal トークンキャッシュ */
let spTokenCache: CachedToken | null = null;

/**
 * Service Principal トークンを取得
 *
 * OAuth Client Credentials フローを使用してトークンを取得します。
 * トークンは有効期限 - 5分のバッファを考慮してキャッシュされます。
 *
 * @param host - Databricks ワークスペースホスト（プロトコル有無どちらでも可）
 * @param clientId - クライアント ID（省略時は環境変数 DATABRICKS_CLIENT_ID から取得）
 * @param clientSecret - クライアントシークレット（省略時は環境変数 DATABRICKS_CLIENT_SECRET から取得）
 * @returns アクセストークン（認証情報がない場合は undefined）
 * @throws トークン取得に失敗した場合
 */
export async function getServicePrincipalToken(
  host: string,
  clientId?: string,
  clientSecret?: string
): Promise<string | undefined> {
  const resolvedClientId = clientId ?? process.env.DATABRICKS_CLIENT_ID;
  const resolvedClientSecret = clientSecret ?? process.env.DATABRICKS_CLIENT_SECRET;

  if (!resolvedClientId || !resolvedClientSecret) {
    return undefined;
  }

  // キャッシュが有効な場合はキャッシュから返す
  if (spTokenCache && spTokenCache.expiresAt > new Date()) {
    return spTokenCache.accessToken;
  }

  // OAuth Client Credentials フローでトークン取得
  const normalizedHost = normalizeHost(host);
  const response = await fetch(`https://${normalizedHost}/oidc/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: resolvedClientId,
      client_secret: resolvedClientSecret,
      scope: 'all-apis',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch SP token (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as TokenResponse;
  const expiresIn = data.expires_in ?? 3600;

  // 5分バッファを考慮してキャッシュ
  spTokenCache = {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (expiresIn - 300) * 1000),
  };

  return spTokenCache.accessToken;
}

/**
 * テスト用: SP トークンキャッシュをクリア
 */
export function clearSpTokenCache(): void {
  spTokenCache = null;
}

/**
 * DB からユーザーの Personal Access Token (PAT) を取得
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザー ID
 * @returns PAT（存在しない場合や取得に失敗した場合は undefined）
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

// ----- AuthProvider 型と Factory -----

type AuthType = 'pat' | 'oauth-m2m';

/**
 * 認証に使用するプリンシパルの種類
 * - 'auto': PAT があれば PAT、なければ SP（デフォルト）
 * - 'pat': PAT のみ使用（なければエラー）
 * - 'sp': Service Principal のみ使用
 */
export type PrincipalType = 'auto' | 'pat' | 'sp';

interface AuthEnvVars {
  /** Auth type (pat or oauth-m2m) */
  DATABRICKS_AUTH_TYPE: AuthType;
  /** Databricks Workspace URL (e.g. https://dbc-123456789.cloud.databricks.com) */
  DATABRICKS_HOST: string;
}

export interface PatEnvVars extends AuthEnvVars {
  DATABRICKS_AUTH_TYPE: 'pat';
  DATABRICKS_TOKEN: string;
}

export interface ServicePrincipalEnvVars extends AuthEnvVars {
  DATABRICKS_AUTH_TYPE: 'oauth-m2m';
  DATABRICKS_CLIENT_ID: string;
  DATABRICKS_CLIENT_SECRET: string;
}

export type AuthProvider =
  | { type: 'pat'; getEnvVars(): PatEnvVars; getToken(): Promise<string> }
  | {
      type: 'oauth-m2m';
      getEnvVars(): ServicePrincipalEnvVars;
      getToken(): Promise<string>;
    };

/**
 * PAT を使用する AuthProvider を作成
 */
function createPatAuthProvider(host: string, token: string): AuthProvider {
  return {
    type: 'pat',
    getEnvVars: () => ({
      DATABRICKS_AUTH_TYPE: 'pat',
      DATABRICKS_HOST: host,
      DATABRICKS_TOKEN: token,
    }),
    getToken: async () => token,
  };
}

/**
 * Service Principal を使用する AuthProvider を作成
 */
function createSpAuthProvider(host: string, clientId: string, clientSecret: string): AuthProvider {
  return {
    type: 'oauth-m2m',
    getEnvVars: () => ({
      DATABRICKS_AUTH_TYPE: 'oauth-m2m',
      DATABRICKS_HOST: host,
      DATABRICKS_CLIENT_ID: clientId,
      DATABRICKS_CLIENT_SECRET: clientSecret,
    }),
    getToken: async () => {
      const spToken = await getServicePrincipalToken(host, clientId, clientSecret);
      if (!spToken) {
        throw new Error('Service Principal token is not available');
      }
      return spToken;
    },
  };
}

/**
 * ユーザーの認証プロバイダーを取得
 *
 * @param fastify - Fastify インスタンス
 * @param userId - ユーザー ID
 * @param principalType - 使用するプリンシパルの種類（デフォルト: 'auto'）
 *   - 'auto': PAT があれば PAT、なければ SP
 *   - 'pat': PAT のみ使用（なければエラー）
 *   - 'sp': Service Principal のみ使用
 * @returns AuthProvider
 * @throws principalType='pat' で PAT が登録されていない場合
 */
export async function getAuthProvider(
  fastify: FastifyInstance,
  userId: string,
  principalType: PrincipalType = 'auto'
): Promise<AuthProvider> {
  const host = `https://${fastify.config.DATABRICKS_HOST}`;
  const { DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET } = fastify.config;

  // SP のみを使用する場合は PAT を確認せずに返す
  if (principalType === 'sp') {
    return createSpAuthProvider(host, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET);
  }

  // PAT を取得
  const token = await getUserPAT(fastify, userId);

  // PAT のみを要求する場合
  if (principalType === 'pat') {
    if (!token) {
      throw new Error('PAT is not registered');
    }
    return createPatAuthProvider(host, token);
  }

  // auto: PAT があれば PAT、なければ SP
  if (token) {
    return createPatAuthProvider(host, token);
  }

  return createSpAuthProvider(host, DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET);
}
