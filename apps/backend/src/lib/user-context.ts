import type { FastifyInstance, FastifyRequest } from 'fastify';
import path from 'node:path';
import { getUserPAT, getServicePrincipalToken } from '../services/token-resolver.service.js';

/**
 * ユーザーコンテキスト
 *
 * リクエストごとのユーザー情報とトークンを管理する。
 * トークンは遅延評価（Lazy getter）で、必要な場合のみ取得される。
 */
export class UserContext {
  /** ユーザー ID */
  readonly userId: string;
  /** ユーザーのホームディレクトリ */
  readonly userHome: string;

  /** PAT キャッシュ（リクエストスコープ）: null = 未取得 */
  private _pat: string | undefined | null = null;

  constructor(
    private readonly fastify: FastifyInstance,
    private readonly request: FastifyRequest
  ) {
    const user = request.ctx!.user;
    this.userId = user.id;
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
   * SP トークンを取得（キャッシュなし - token-resolver.service 側でグローバルキャッシュあり）
   * OAuth から取得するため非同期
   */
  async getSpAccessToken(): Promise<string | undefined> {
    return getServicePrincipalToken(this.fastify);
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
