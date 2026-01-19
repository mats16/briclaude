/**
 * Databricks 認証ユーティリティ
 *
 * Service Principal (SP) を使用した OAuth Client Credentials フローでトークンを取得します。
 */

import { normalizeHost } from './normalize-host.js';

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
