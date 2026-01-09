// apps/backend/src/plugins/request-context.ts
import fp from 'fastify-plugin';
import { requestContext, fastifyRequestContext } from '@fastify/request-context';
import { getUserPAT, getServicePrincipalToken } from '../services/token-resolver.service.js';

/**
 * リクエストコンテキストで利用可能なトークン情報
 */
export interface TokenContextData {
  /** ユーザーの PAT（DB から取得） */
  pat: string | null;
  /** OBO アクセストークン（Databricks Apps ヘッダーから取得） */
  obo_access_token: string | null;
  /** Service Principal アクセストークン（OAuth Client Credentials から取得） */
  sp_access_token: string | null;
}

// @fastify/request-context の型拡張
declare module '@fastify/request-context' {
  interface RequestContextData extends TokenContextData {}
}

/**
 * Request Context Plugin
 *
 * リクエストごとに各種トークンを取得し、
 * `@fastify/request-context` を通じてアプリケーション全体で利用可能にします。
 *
 * 取得可能なトークン:
 * - `pat`: ユーザーが登録した PAT（DB から取得）
 * - `obo_access_token`: Databricks Apps が提供する OBO トークン
 * - `sp_access_token`: Service Principal トークン（キャッシュ付き）
 *
 * サービス側でフォールバックロジックを実装できます。
 *
 * 依存関係:
 * - config: DATABRICKS_* 環境変数を取得するため
 * - db: PAT を DB から取得するため
 * - request-decorator: ユーザー情報と OBO トークンを取得するため
 */
export default fp(
  async fastify => {
    // SP 認証情報がない場合はログ出力（起動は継続）
    if (!fastify.config.DATABRICKS_CLIENT_ID || !fastify.config.DATABRICKS_CLIENT_SECRET) {
      fastify.log.info('Service Principal credentials not configured, SP token fallback disabled');
    }

    // @fastify/request-context を登録
    await fastify.register(fastifyRequestContext, {
      defaultStoreValues: {
        pat: null,
        obo_access_token: null,
        sp_access_token: null,
      },
      hook: 'preHandler',
    });

    // preHandler フックでトークンを取得
    fastify.addHook('preHandler', async request => {
      const userId = request.ctx?.user.id ?? '';
      const oboAccessToken = request.ctx?.user.oboAccessToken;

      // 各トークンを並列で取得
      const [pat, spAccessToken] = await Promise.all([
        getUserPAT(fastify, userId),
        getServicePrincipalToken(fastify),
      ]);

      // コンテキストに設定
      requestContext.set('pat', pat);
      requestContext.set('obo_access_token', oboAccessToken || null);
      requestContext.set('sp_access_token', spAccessToken);

      // デバッグログ
      request.log.debug(
        {
          userId: userId || 'anonymous',
          hasPat: pat !== null,
          hasObo: !!oboAccessToken,
          hasSp: spAccessToken !== null,
        },
        'Token context resolved'
      );
    });

    fastify.log.info('Request context plugin initialized');
  },
  {
    name: 'request-context',
    dependencies: ['config', 'db', 'request-decorator'],
  }
);

// requestContext を再エクスポート（ルートで使用しやすくするため）
export { requestContext };
