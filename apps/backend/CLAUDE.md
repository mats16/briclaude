# Backend Application

Fastify 5 で構築された REST API サーバー。Drizzle ORM でデータベース操作、Claude Agent SDK で AI 機能を提供。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Fastify 5.2.0 |
| ORM | Drizzle ORM 1.0.0-beta |
| AI | Claude Agent SDK |
| データベース | PostgreSQL (postgres.js) |
| テスト | Vitest |
| 開発 | tsx 4.x |

## ディレクトリ構造

```
src/
├── db/                # データベース (schema, helpers)
├── plugins/           # Fastify プラグイン
│   ├── config.ts      # 環境変数設定 (@fastify/env)
│   ├── database.ts    # データベース接続 (Drizzle)
│   ├── request-context.ts  # リクエストコンテキスト
│   ├── request-decorator.ts # リクエストデコレータ
│   └── static.ts      # 静的ファイル配信
├── routes/            # API ルート
│   ├── health.ts      # ヘルスチェック
│   ├── session.ts     # セッション管理
│   ├── user.ts        # ユーザー情報
│   ├── user-tokens.ts # トークン管理
│   └── title.ts       # タイトル生成
├── services/          # ビジネスロジック
│   ├── session.service.ts
│   ├── title.service.ts
│   ├── token-resolver.service.ts
│   └── user.service.ts
├── utils/             # ユーティリティ (encryption)
├── app.ts             # Fastify アプリ設定
└── server.ts          # サーバーエントリポイント
```

## ルート定義パターン

TypeScript ジェネリクスで型安全なルート:

```typescript
import { FastifyPluginAsync } from 'fastify';
import type { HealthCheckResponse } from '@repo/types';

const healthRoute: FastifyPluginAsync = async fastify => {
  fastify.get<{ Reply: HealthCheckResponse }>('/health', async (request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'claude-code-on-databricks',
    });
  });
};

export default healthRoute;
```

### リクエスト/レスポンス型

```typescript
fastify.post<{
  Params: { id: string };
  Querystring: { filter?: string };
  Body: CreateUserRequest;
  Reply: UserResponse;
}>('/users/:id', async (request, reply) => {
  const { id } = request.params;
  const { filter } = request.query;
  const { name, email } = request.body;
  // ...
});
```

## プラグインシステム

### 登録順序

```typescript
// app.ts
export async function build() {
  const app = Fastify({ logger: true });

  // 1. 設定プラグイン
  await app.register(configPlugin);

  // 2. データベースプラグイン
  await app.register(databasePlugin);

  // 3. リクエストデコレータ
  await app.register(requestDecoratorPlugin);

  // 4. API ルート
  await app.register(healthRoute, { prefix: '/api' });
  await app.register(sessionRoute, { prefix: '/api' });

  // 5. 静的ファイル配信（最後）
  await app.register(staticPlugin);

  return app;
}
```

### リクエストコンテキスト

Databricks Apps のヘッダーからユーザー情報を取得:

```typescript
fastify.get('/example', async (request, reply) => {
  const userId = request.ctx?.user.id;
  const userName = request.ctx?.user.name;
  const requestId = request.ctx?.requestId;
  // ...
});
```

| ヘッダー | コンテキスト | フォールバック |
|---------|-------------|---------------|
| `x-forwarded-user` | `ctx.user.id` | Empty string |
| `x-forwarded-preferred-username` | `ctx.user.name` | Empty string |
| `x-forwarded-email` | `ctx.user.email` | Empty string |
| `x-forwarded-access-token` | `ctx.user.oboAccessToken` | Empty string |
| `x-request-id` | `ctx.requestId` | Generated UUID |

## データベース (Drizzle ORM)

### スキーマ定義

```typescript
// src/db/schema.ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### クエリ

```typescript
import { db } from '../plugins/database.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Select
const user = await db.select().from(users).where(eq(users.id, userId));

// Insert
await db.insert(users).values({ id, name, email });

// Update
await db.update(users).set({ name }).where(eq(users.id, userId));
```

### マイグレーション

```bash
npm run db:generate   # マイグレーションファイル生成
npm run db:migrate    # マイグレーション実行
npm run db:push       # スキーマを直接プッシュ
npm run db:studio     # Drizzle Studio 起動
```

## 環境変数

### 必須

```bash
DATABASE_URL=postgresql://localhost:5432/mydb
ENCRYPTION_KEY=your-64-character-hex-key
DATABRICKS_HOST=your-workspace.databricks.com
```

### オプション

```bash
NODE_ENV=development          # development | production | test
PORT=8000                     # サーバーポート
USER_BASE_DIR=/home/app/users # ユーザーディレクトリ
SESSION_BASE_DIR=/home/app/ws # セッションディレクトリ

# Anthropic API
ANTHROPIC_BASE_URL=https://your-workspace.databricks.com/serving-endpoints/anthropic
ANTHROPIC_DEFAULT_OPUS_MODEL=databricks-claude-opus-4-5
ANTHROPIC_DEFAULT_SONNET_MODEL=databricks-claude-sonnet-4-5
ANTHROPIC_DEFAULT_HAIKU_MODEL=databricks-claude-haiku-4-5
```

### 設定へのアクセス

```typescript
fastify.get('/example', async (request, reply) => {
  const port = fastify.config.PORT;
  const nodeEnv = fastify.config.NODE_ENV;
  const databaseUrl = fastify.config.DATABASE_URL;
  // ...
});
```

## 静的ファイル配信

Fastify から React フロントエンドを直接配信:

- `/api/*` → API エンドポイント
- その他 → `frontend/dist` の静的ファイル
- SPA フォールバック → `index.html`

### キャッシュ戦略

| ファイル種類 | キャッシュ |
|------------|----------|
| JS/CSS/フォント | 1年（immutable） |
| HTML/画像 | 1時間（must-revalidate） |
| API | キャッシュなし |

## テスト

### テストの実行

```bash
npm run test           # テスト実行
npm run test:watch     # ウォッチモード
npm run test:ui        # Vitest UI
npm run test:coverage  # カバレッジ
```

### テストパターン

```typescript
// routes/health.test.ts
import { build } from '../app.js';
import { describe, it, expect, afterAll } from 'vitest';

describe('Health Route', () => {
  const app = await build();

  afterAll(() => app.close());

  it('returns health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
    });
  });
});
```

## エラーハンドリング

### 標準エラーレスポンス

```typescript
import type { ApiError } from '@repo/types';

fastify.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const errorResponse: ApiError = {
    error: error.name || 'InternalServerError',
    message: error.message || 'An unexpected error occurred',
    statusCode,
  };
  reply.status(statusCode).send(errorResponse);
});
```

### ルートレベル

```typescript
fastify.get('/users/:id', async (request, reply) => {
  const user = await fetchUser(request.params.id);

  if (!user) {
    return reply.status(404).send({
      error: 'NotFound',
      message: 'User not found',
      statusCode: 404,
    });
  }

  return reply.send(user);
});
```

## 開発

```bash
npm run dev      # 開発サーバー (tsx watch)
npm run build    # TypeScript ビルド
npm run start    # 本番サーバー起動
```

## トラブルシューティング

### ポートが使用中

```bash
lsof -i :8000    # プロセスを確認
kill -9 <PID>    # プロセスを終了
```

### 型エラー

1. `@repo/types` をビルド: `npm run build --filter=@repo/types`
2. インポートパスに `.js` 拡張子を使用（ESM 要件）

### データベース接続エラー

1. PostgreSQL が起動しているか確認
2. `DATABASE_URL` が正しいか確認
3. `npm run db:push` でスキーマを同期
