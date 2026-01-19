import type { FastifyInstance, FastifyRequest } from 'fastify';
import path from 'node:path';
import { getAuthProvider, type AuthProvider } from './databricks-auth.js';

/**
 * ユーザーコンテキスト
 *
 * リクエストごとのユーザー情報とトークンを管理する。
 * 認証は AuthProvider に委譲し、遅延評価でキャッシュされる。
 */
export class UserContext {
  /** ユーザー ID */
  readonly userId: string;
  /** ユーザー名 (x-forwarded-preferred-username) */
  readonly userName: string;
  /** ユーザーのホームディレクトリ */
  readonly userHome: string;

  /** AuthProvider キャッシュ（リクエストスコープ）: null = 未取得 */
  private _authProvider: AuthProvider | null = null;

  constructor(
    private readonly fastify: FastifyInstance,
    private readonly request: FastifyRequest
  ) {
    if (!request.ctx?.user) {
      throw new Error('User context is not available');
    }
    const user = request.ctx.user;
    this.userId = user.id;
    this.userName = user.name;
    this.userHome = path.join(fastify.config.USER_BASE_DIR, user.id.split('@')[0]);
  }

  /**
   * AuthProvider を取得（遅延評価、リクエストスコープでキャッシュ）
   * PAT が登録されていれば PAT、なければ SP を使用
   */
  async getAuthProvider(): Promise<AuthProvider> {
    if (this._authProvider === null) {
      this._authProvider = await getAuthProvider(this.fastify, this.userId);
    }
    return this._authProvider;
  }

  /**
   * OBO トークンを取得（即時）
   * リクエストヘッダーから取得済みなので同期的
   */
  get oboAccessToken(): string | undefined {
    const token = this.request.ctx?.user.oboAccessToken;
    return token && token !== '' ? token : undefined;
  }
}

/**
 * UserContext を作成するファクトリ関数
 */
export function createUserContext(fastify: FastifyInstance, request: FastifyRequest): UserContext {
  return new UserContext(fastify, request);
}
