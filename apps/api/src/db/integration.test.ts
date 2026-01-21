// apps/api/src/db/integration.test.ts
// 統合テスト: 実際のデータベースに接続してテスト
// ローカル: .env の DATABASE_URL を使用
// CI: Docker の PostgreSQL を使用

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql, eq } from 'drizzle-orm';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';

// .env をロード（ローカル開発用）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, '../../../../.env') });

// テスト用のユーザーID
const TEST_USER_1 = 'test-user-1';
const TEST_USER_2 = 'test-user-2';
// sessions.id は uuid 型なので有効な UUID を使用
const TEST_SESSION_1 = '11111111-1111-1111-1111-111111111111';
const TEST_SESSION_2 = '22222222-2222-2222-2222-222222222222';

describe('Database Integration Tests', () => {
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;

  /**
   * RLS 保護テーブルへのアクセス用ヘルパー
   * app.user_id を設定してからコールバックを実行
   */
  async function withTestUserContext<T>(
    userId: string,
    callback: (tx: typeof db) => Promise<T>
  ): Promise<T> {
    return db.transaction(async tx => {
      await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
      return callback(tx as unknown as typeof db);
    });
  }

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    client = postgres(databaseUrl, { max: 1 });
    db = drizzle({ client, schema });

    // マイグレーション実行
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const migrationsFolder = path.join(__dirname, '../../migrations');
    await migrate(db, { migrationsFolder });

    // 常に FORCE ROW LEVEL SECURITY を適用
    // 理由:
    // 1. BYPASSRLS 属性を持つユーザー（ローカル Neon など）は RLS をバイパスする
    // 2. テーブルオーナー（CI で testuser がマイグレーションを実行した場合など）も RLS をバイパスする
    // FORCE RLS により、どちらのケースでも RLS が強制される
    await client`ALTER TABLE sessions FORCE ROW LEVEL SECURITY`;
    await client`ALTER TABLE user_settings FORCE ROW LEVEL SECURITY`;
    await client`ALTER TABLE oauth_tokens FORCE ROW LEVEL SECURITY`;
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  beforeEach(async () => {
    // テストデータをクリーンアップ
    // TRUNCATE は RLS をバイパスするため、ユーザーコンテキストなしで実行可能
    // CASCADE で外部キー参照を持つテーブルも一緒にクリア
    await client`TRUNCATE TABLE session_events, sessions, oauth_tokens, user_settings, users CASCADE`;
  });

  describe('sessionEvents table', () => {
    beforeEach(async () => {
      // テスト用ユーザーを作成（users テーブルは RLS なし）
      await db.insert(schema.users).values({ id: TEST_USER_1 });
      // セッションを作成（RLS 保護テーブルなのでユーザーコンテキストが必要）
      await withTestUserContext(TEST_USER_1, async tx => {
        await tx.insert(schema.sessions).values({
          id: TEST_SESSION_1,
          userId: TEST_USER_1,
          title: 'Test Session',
        });
      });
    });

    it('should insert events with uuid as primary key', async () => {
      const uuid1 = '11111111-1111-1111-1111-111111111111';
      const uuid2 = '22222222-2222-2222-2222-222222222222';

      await db.insert(schema.sessionEvents).values({
        uuid: uuid1,
        sessionId: TEST_SESSION_1,
        type: 'message',
        message: { content: 'First message' },
      });

      await db.insert(schema.sessionEvents).values({
        uuid: uuid2,
        sessionId: TEST_SESSION_1,
        type: 'message',
        message: { content: 'Second message' },
      });

      const events = await db.select().from(schema.sessionEvents);
      expect(events).toHaveLength(2);
      expect(events.map(e => e.uuid).sort()).toEqual([uuid1, uuid2].sort());
    });

    it('should store jsonb message correctly', async () => {
      const complexMessage = {
        type: 'user',
        content: 'Hello',
        metadata: {
          timestamp: '2024-01-01T00:00:00Z',
          tags: ['important', 'test'],
        },
      };

      const uuid = '77777777-7777-7777-7777-777777777777';
      await db.insert(schema.sessionEvents).values({
        uuid,
        sessionId: TEST_SESSION_1,
        type: 'message',
        message: complexMessage,
      });

      // データベースから取得して確認
      const [retrieved] = await db
        .select()
        .from(schema.sessionEvents)
        .where(eq(schema.sessionEvents.uuid, uuid));

      expect(retrieved.message).toEqual(complexMessage);
    });

    it('should reject duplicate uuid', async () => {
      const uuid = '88888888-8888-8888-8888-888888888888';

      await db.insert(schema.sessionEvents).values({
        uuid,
        sessionId: TEST_SESSION_1,
        type: 'message',
        message: { content: 'First' },
      });

      await expect(
        db.insert(schema.sessionEvents).values({
          uuid, // 同じ uuid
          sessionId: TEST_SESSION_1,
          type: 'message',
          message: { content: 'Second' },
        })
      ).rejects.toThrow();
    });
  });

  describe('RLS (Row Level Security)', () => {
    let skipRlsTests = false;

    beforeAll(async () => {
      // 現在のロールがBYPASSRLS属性を持っているかチェック
      // Neonのneondb_ownerなど、BYPASSRLS属性があるとRLSをバイパスするためテストをスキップ
      const result = await client`
        SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user
      `;
      skipRlsTests = result[0]?.rolbypassrls === true;
      if (skipRlsTests) {
        console.log('Skipping RLS tests: current role has BYPASSRLS attribute');
      }
    });

    beforeEach(async () => {
      // 2人のユーザーを作成（users テーブルは RLS なし）
      await db.insert(schema.users).values([{ id: TEST_USER_1 }, { id: TEST_USER_2 }]);

      // 各ユーザーのセッションを作成（RLS 保護テーブル）
      await withTestUserContext(TEST_USER_1, async tx => {
        await tx.insert(schema.sessions).values({
          id: TEST_SESSION_1,
          userId: TEST_USER_1,
          title: 'User 1 Session',
        });
      });
      await withTestUserContext(TEST_USER_2, async tx => {
        await tx.insert(schema.sessions).values({
          id: TEST_SESSION_2,
          userId: TEST_USER_2,
          title: 'User 2 Session',
        });
      });

      // 各ユーザーの設定を作成（RLS 保護テーブル）
      await withTestUserContext(TEST_USER_1, async tx => {
        await tx.insert(schema.userSettings).values({
          userId: TEST_USER_1,
          claudeConfigBackup: 'auto',
        });
      });
      await withTestUserContext(TEST_USER_2, async tx => {
        await tx.insert(schema.userSettings).values({
          userId: TEST_USER_2,
          claudeConfigBackup: 'disabled',
        });
      });
    });

    /**
     * RLSコンテキスト付きでクエリを実行するヘルパー
     * set_config を使用してパラメータを安全に渡す
     */
    async function withUserContext<T>(
      userId: string,
      callback: (tx: typeof db) => Promise<T>
    ): Promise<T> {
      return db.transaction(async tx => {
        // set_config の第3引数 true = is_local（SET LOCAL と同等）
        await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
        return callback(tx as unknown as typeof db);
      });
    }

    describe('sessions table', () => {
      it('should only return sessions for the current user', async () => {
        if (skipRlsTests) return;

        const user1Sessions = await withUserContext(TEST_USER_1, async tx => {
          return tx.select().from(schema.sessions);
        });

        expect(user1Sessions).toHaveLength(1);
        expect(user1Sessions[0].id).toBe(TEST_SESSION_1);
        expect(user1Sessions[0].userId).toBe(TEST_USER_1);
      });

      it('should not allow access to other users sessions', async () => {
        if (skipRlsTests) return;

        const user1Sessions = await withUserContext(TEST_USER_1, async tx => {
          return tx.select().from(schema.sessions).where(eq(schema.sessions.id, TEST_SESSION_2));
        });

        expect(user1Sessions).toHaveLength(0);
      });

      it('should allow user to update their own session', async () => {
        if (skipRlsTests) return;

        await withUserContext(TEST_USER_1, async tx => {
          await tx
            .update(schema.sessions)
            .set({ title: 'Updated Title' })
            .where(eq(schema.sessions.id, TEST_SESSION_1));
        });

        // RLS コンテキスト付きで確認
        const [updated] = await withUserContext(TEST_USER_1, async tx => {
          return tx.select().from(schema.sessions).where(eq(schema.sessions.id, TEST_SESSION_1));
        });

        expect(updated.title).toBe('Updated Title');
      });

      it('should not allow user to update other users session', async () => {
        if (skipRlsTests) return;

        await withUserContext(TEST_USER_1, async tx => {
          await tx
            .update(schema.sessions)
            .set({ title: 'Hacked Title' })
            .where(eq(schema.sessions.id, TEST_SESSION_2));
        });

        // User 2のセッションは変更されていないはず（User 2 のコンテキストで確認）
        const [notUpdated] = await withUserContext(TEST_USER_2, async tx => {
          return tx.select().from(schema.sessions).where(eq(schema.sessions.id, TEST_SESSION_2));
        });

        expect(notUpdated.title).toBe('User 2 Session');
      });
    });

    describe('user_settings table', () => {
      it('should only return settings for the current user', async () => {
        if (skipRlsTests) return;

        const user1Settings = await withUserContext(TEST_USER_1, async tx => {
          return tx.select().from(schema.userSettings);
        });

        expect(user1Settings).toHaveLength(1);
        expect(user1Settings[0].userId).toBe(TEST_USER_1);
        expect(user1Settings[0].claudeConfigBackup).toBe('auto');
      });

      it('should allow user to update their own settings', async () => {
        if (skipRlsTests) return;

        await withUserContext(TEST_USER_1, async tx => {
          await tx
            .update(schema.userSettings)
            .set({ claudeConfigBackup: 'disabled' })
            .where(eq(schema.userSettings.userId, TEST_USER_1));
        });

        // RLS コンテキスト付きで確認
        const [updated] = await withUserContext(TEST_USER_1, async tx => {
          return tx
            .select()
            .from(schema.userSettings)
            .where(eq(schema.userSettings.userId, TEST_USER_1));
        });

        expect(updated.claudeConfigBackup).toBe('disabled');
      });
    });

    describe('oauth_tokens table', () => {
      beforeEach(async () => {
        if (skipRlsTests) return;

        // 暗号化キーが必要
        if (!process.env.ENCRYPTION_KEY) {
          process.env.ENCRYPTION_KEY = 'a'.repeat(64);
        }

        // 各ユーザーのトークンを作成（RLS 保護テーブル）
        await withTestUserContext(TEST_USER_1, async tx => {
          await tx.insert(schema.oauthTokens).values({
            userId: TEST_USER_1,
            provider: 'github',
            authType: 'oauth',
            accessToken: 'token1',
          });
        });
        await withTestUserContext(TEST_USER_2, async tx => {
          await tx.insert(schema.oauthTokens).values({
            userId: TEST_USER_2,
            provider: 'github',
            authType: 'oauth',
            accessToken: 'token2',
          });
        });
      });

      it('should only return tokens for the current user', async () => {
        if (skipRlsTests) return;

        const user1Tokens = await withUserContext(TEST_USER_1, async tx => {
          return tx.select().from(schema.oauthTokens);
        });

        expect(user1Tokens).toHaveLength(1);
        expect(user1Tokens[0].userId).toBe(TEST_USER_1);
      });

      it('should not allow access to other users tokens', async () => {
        if (skipRlsTests) return;

        const user1Tokens = await withUserContext(TEST_USER_1, async tx => {
          return tx
            .select()
            .from(schema.oauthTokens)
            .where(eq(schema.oauthTokens.userId, TEST_USER_2));
        });

        expect(user1Tokens).toHaveLength(0);
      });
    });
  });

  describe('Encryption in database', () => {
    /**
     * RLSコンテキスト付きでクエリを実行するヘルパー
     */
    async function withUserContext<T>(
      userId: string,
      callback: (tx: typeof db) => Promise<T>
    ): Promise<T> {
      return db.transaction(async tx => {
        await tx.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`);
        return callback(tx as unknown as typeof db);
      });
    }

    beforeEach(async () => {
      if (!process.env.ENCRYPTION_KEY) {
        process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      }

      await db.insert(schema.users).values({ id: TEST_USER_1 });
    });

    it('should encrypt access_token when stored and decrypt when retrieved', async () => {
      const originalToken = 'my-secret-access-token';

      // RLSコンテキスト付きでINSERT
      await withUserContext(TEST_USER_1, async tx => {
        await tx.insert(schema.oauthTokens).values({
          userId: TEST_USER_1,
          provider: 'github',
          authType: 'oauth',
          accessToken: originalToken,
        });
      });

      // Drizzle経由で取得（復号化される）
      const [retrieved] = await withUserContext(TEST_USER_1, async tx => {
        return tx
          .select()
          .from(schema.oauthTokens)
          .where(eq(schema.oauthTokens.userId, TEST_USER_1));
      });

      expect(retrieved.accessToken).toBe(originalToken);

      // 生SQLで取得（暗号化されたまま）
      // RLS が有効なため、トランザクション内で app.user_id を設定
      const rawResult = await db.transaction(async tx => {
        await tx.execute(sql`SELECT set_config('app.user_id', ${TEST_USER_1}, true)`);
        return tx.execute(
          sql`SELECT access_token FROM oauth_tokens WHERE user_id = ${TEST_USER_1}`
        );
      });

      const encryptedToken = (rawResult[0] as { access_token: string }).access_token;
      expect(encryptedToken).not.toBe(originalToken);
      // Base64形式であることを確認
      expect(() => Buffer.from(encryptedToken, 'base64')).not.toThrow();
    });

    it('should handle nullable refresh_token correctly', async () => {
      // refresh_token なし
      await withUserContext(TEST_USER_1, async tx => {
        await tx.insert(schema.oauthTokens).values({
          userId: TEST_USER_1,
          provider: 'provider1',
          authType: 'type1',
          accessToken: 'token1',
          refreshToken: null,
        });
      });

      const [withoutRefresh] = await withUserContext(TEST_USER_1, async tx => {
        return tx
          .select()
          .from(schema.oauthTokens)
          .where(eq(schema.oauthTokens.provider, 'provider1'));
      });

      expect(withoutRefresh.refreshToken).toBeNull();

      // refresh_token あり
      await withUserContext(TEST_USER_1, async tx => {
        await tx.insert(schema.oauthTokens).values({
          userId: TEST_USER_1,
          provider: 'provider2',
          authType: 'type2',
          accessToken: 'token2',
          refreshToken: 'my-refresh-token',
        });
      });

      const [withRefresh] = await withUserContext(TEST_USER_1, async tx => {
        return tx
          .select()
          .from(schema.oauthTokens)
          .where(eq(schema.oauthTokens.provider, 'provider2'));
      });

      expect(withRefresh.refreshToken).toBe('my-refresh-token');
    });
  });
});
