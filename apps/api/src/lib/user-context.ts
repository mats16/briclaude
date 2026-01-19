import type { FastifyInstance, FastifyRequest } from 'fastify';
import path from 'node:path';
import { getUserPAT, getServicePrincipalTokenFromConfig } from '../utils/databricks-auth.js';

/**
 * ユーザーコンテキスト
 *
 * リクエストごとのユーザー情報とトークンを管理する。
 * トークンは遅延評価（Lazy getter）で、必要な場合のみ取得される。
 */
export class UserContext {
  /** ユーザー ID */
  readonly userId: string;
  /** ユーザー名 (x-forwarded-preferred-username) */
  readonly userName: string;
  /** ユーザーのホームディレクトリ */
  readonly userHome: string;

  /** PAT キャッシュ（リクエストスコープ）: null = 未取得 */
  private _pat: string | undefined | null = null;

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
   * PAT を取得（遅延評価、リクエストスコープでキャッシュ）
   * DB から取得するため非同期
   */
  async getPat(): Promise<string | undefined> {
    if (this._pat === null) {
      this._pat = await getUserPAT(this.fastify, this.userId);
    }
    return this._pat;
  }

  /**
   * OBO トークンを取得（即時）
   * リクエストヘッダーから取得済みなので同期的
   */
  get oboAccessToken(): string | undefined {
    const token = this.request.ctx?.user.oboAccessToken;
    return token && token !== '' ? token : undefined;
  }

  /**
   * SP トークンを取得（グローバルキャッシュあり）
   * OAuth から取得するため非同期
   */
  async getSpAccessToken(): Promise<string | undefined> {
    return getServicePrincipalTokenFromConfig(this.fastify);
  }

  /**
   * PAT → SP のフォールバック付きでトークンを取得
   */
  async getAccessToken(): Promise<string | undefined> {
    return (await this.getPat()) ?? (await this.getSpAccessToken());
  }
}

/**
 * UserContext を作成するファクトリ関数
 */
export function createUserContext(fastify: FastifyInstance, request: FastifyRequest): UserContext {
  return new UserContext(fastify, request);
}
