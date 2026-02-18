# ローカル開発ガイド

このガイドでは、Briclaude をローカルで開発するためのセットアップと実行方法を説明します。

## 前提条件

- **Node.js**: 22.x（LTS）
- **npm**: 10.0.0 以上
- **PostgreSQL**: 14 以上（ローカルまたはリモート）
- **Git**: バージョン管理用

## アーキテクチャ概要

ローカル開発では、アプリケーションは 2 つのサーバーで動作します:

```
┌────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────┐          ┌─────────────────────────┐ │
│  │ Vite Dev Server     │ headers  │ Fastify Backend         │ │
│  │ (port 3003)         │─────────▶│ (port 8003)             │ │
│  │ ├─ React HMR        │ emulated │ └─ /api/* (API routes)  │ │
│  │ └─ /api/* proxy     │          │                         │ │
│  └─────────────────────┘          └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

- **Vite Dev Server (port 3003)**: Hot Module Replacement 機能付きで React フロントエンドを配信
- **Fastify Backend (port 8003)**: API リクエストを処理
- **API プロキシ**: Vite が自動的に `/api/*` リクエストをバックエンドにプロキシし、認証ヘッダーを注入

## 1. リポジトリのセットアップ

### 1.1 リポジトリのクローン

```bash
git clone https://github.com/mats16/briclaude.git
cd briclaude
```

### 1.2 依存関係のインストール

```bash
npm install
```

これにより、すべてのワークスペース（apps と packages）の依存関係がインストールされます。

## 2. データベースのセットアップ

### 2.1 PostgreSQL の起動

**Docker を使用する場合（推奨）:**

```bash
docker run -d \
  --name briclaude-postgres \
  -e POSTGRES_USER=briclaude_user \
  -e POSTGRES_PASSWORD=localdev \
  -e POSTGRES_DB=briclaude \
  -p 5432:5432 \
  postgres:16
```

**ローカルの PostgreSQL を使用する場合:**

```sql
-- ユーザーの作成
CREATE ROLE briclaude_user WITH LOGIN PASSWORD 'localdev' NOBYPASSRLS;

-- 現在のユーザーにロールを付与
GRANT briclaude_user TO CURRENT_USER WITH SET TRUE;

-- データベースの作成
CREATE DATABASE briclaude OWNER briclaude_user;
```

### 2.2 データベースマイグレーション

マイグレーションはサーバー起動時に自動的に適用されます。手動でマイグレーションを実行する場合:

```bash
cd apps/api

# マイグレーションファイルを生成（スキーマ変更時）
npm run db:generate

# 手動でマイグレーションを適用
npm run db:migrate

# またはスキーマを直接プッシュ（開発時のみ）
npm run db:push
```

## 3. 環境変数

### 3.1 .env ファイルの作成

サンプルファイルをコピーして設定します:

```bash
cp .env.example .env
```

### 3.2 必須変数

`.env` を編集して設定します:

```bash
# サーバー
PORT=8003
NODE_ENV=development

# データベース（必須）
DATABASE_URL=postgresql://briclaude_user:localdev@localhost:5432/briclaude

# 暗号化（必須 - 生成コマンド: openssl rand -hex 32）
ENCRYPTION_KEY=your-64-character-hex-key

# Databricks（必須）
DATABRICKS_HOST=your-workspace.cloud.databricks.com

# 開発環境: Databricks 認証ヘッダーのエミュレーション（ローカル認証に必須）
DATABRICKS_TOKEN=your-personal-access-token
DATABRICKS_USER_NAME=your-name
DATABRICKS_USER_ID=your-user-id
DATABRICKS_USER_EMAIL=your-email@example.com
```

### 3.3 オプション変数

```bash
# SQL Warehouse（Databricks SQL を使用する場合）
WAREHOUSE_ID=your-warehouse-id

# Anthropic API（デフォルトは Databricks サービングエンドポイント）
ANTHROPIC_BASE_URL=https://your-workspace.databricks.com/serving-endpoints/anthropic
ANTHROPIC_DEFAULT_OPUS_MODEL=databricks-claude-opus-4-5
ANTHROPIC_DEFAULT_SONNET_MODEL=databricks-claude-sonnet-4-5
ANTHROPIC_DEFAULT_HAIKU_MODEL=databricks-claude-haiku-4-5

# ユーザーディレクトリ
USER_BASE_DIR=/path/to/user/directories
```

### 3.4 暗号化キーの生成

```bash
openssl rand -hex 32
```

出力を `.env` ファイルの `ENCRYPTION_KEY` にコピーしてください。

## 4. 開発サーバーの起動

### 4.1 すべてのアプリを起動

```bash
npm run dev
```

これにより、フロントエンドとバックエンドの両方が開発モードで起動します:
- フロントエンド: http://localhost:3003
- バックエンド: http://localhost:8003

### 4.2 個別のアプリを起動

```bash
# フロントエンドのみ
npm run dev --filter=@repo/web

# バックエンドのみ
npm run dev --filter=@repo/api
```

### 4.3 アプリケーションへのアクセス

ブラウザで http://localhost:3003 を開いてください。

## 5. 開発コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | すべてのアプリを開発モードで起動 |
| `npm run build` | すべてのパッケージをビルド |
| `npm run lint` | ESLint を実行 |
| `npm run format` | Prettier でコードをフォーマット |
| `npm run type-check` | TypeScript の型チェックを実行 |
| `npm run test` | テストを実行 |
| `npm run clean` | ビルド成果物と node_modules を削除 |

### Turborepo の操作

```bash
# 特定のパッケージをビルド
npm run build --filter=@repo/types

# 特定のアプリで dev を実行
npm run dev --filter=@repo/api

# キャッシュを無視して強制リビルド
npm run build --force
```

### データベースコマンド（apps/api 内）

```bash
cd apps/api

npm run db:generate   # スキーマ変更からマイグレーションファイルを生成
npm run db:migrate    # 保留中のマイグレーションを実行
npm run db:push       # スキーマを直接プッシュ（開発時のみ）
npm run db:studio     # Drizzle Studio を開く（データベース GUI）
```

## 6. 開発環境での認証

本番環境では、Databricks Apps のプロキシが認証を処理し、ヘッダー経由でユーザー情報を転送します。開発環境では、Vite が環境変数からヘッダーを注入してこれをエミュレートします。

### 仕組み

1. Vite 開発サーバーがポート 3003 でリクエストを受信
2. `/api/*` リクエストの場合、Vite がバックエンド（ポート 8003）にプロキシ
3. Vite が `.env` の値を使用して Databricks スタイルのヘッダーを注入
4. バックエンドが本番環境と同様にヘッダーからユーザー情報を読み取り

### エミュレートされるヘッダー

| ヘッダー | 環境変数 |
|--------|----------|
| `x-forwarded-user` | `DATABRICKS_USER_ID` |
| `x-forwarded-preferred-username` | `DATABRICKS_USER_NAME` |
| `x-forwarded-email` | `DATABRICKS_USER_EMAIL` |
| `x-forwarded-access-token` | `DATABRICKS_TOKEN` |

## 7. プロジェクト構成

```
briclaude/
├── apps/
│   ├── web/               # React 19 + Vite 7 + shadcn/ui
│   │   ├── src/
│   │   │   ├── components/  # React コンポーネント
│   │   │   ├── contexts/    # React コンテキスト
│   │   │   ├── hooks/       # カスタムフック
│   │   │   ├── i18n/        # 国際化
│   │   │   └── services/    # API クライアント
│   │   └── CLAUDE.md        # フロントエンドガイドライン
│   └── api/               # Fastify 5 + Drizzle ORM
│       ├── src/
│       │   ├── db/          # データベーススキーマ
│       │   ├── plugins/     # Fastify プラグイン
│       │   ├── routes/      # API ルート
│       │   ├── services/    # ビジネスロジック
│       │   └── utils/       # ユーティリティ
│       └── CLAUDE.md        # バックエンドガイドライン
└── packages/
    ├── types/             # 共有 TypeScript 型定義
    ├── eslint-config/     # 共有 ESLint 設定
    └── typescript-config/ # 共有 TypeScript 設定
```

## トラブルシューティング

### ポートが既に使用中

```bash
# ポートを使用しているプロセスを検索
lsof -i :3003  # または :8003

# プロセスを終了
kill -9 <PID>
```

### スキーマ変更後の型エラー

1. まず types パッケージをビルド:
   ```bash
   npm run build --filter=@repo/types
   ```

2. エディタで TypeScript サーバーを再起動

### データベース接続エラー

1. PostgreSQL が起動していることを確認:
   ```bash
   docker ps  # Docker を使用している場合
   pg_isready -h localhost -p 5432  # 接続を確認
   ```

2. `.env` の `DATABASE_URL` が正しいことを確認

3. データベースが存在することを確認:
   ```bash
   psql -h localhost -U briclaude_user -d briclaude -c "SELECT 1"
   ```

### Turborepo キャッシュの問題

```bash
# Turborepo キャッシュをクリア
rm -rf .turbo

# 完全なクリーンと再インストール
npm run clean && npm install
```

### API プロキシが動作しない

1. バックエンドがポート 8003 で起動していることを確認
2. `apps/web/vite.config.ts` の Vite 設定を確認
3. ブラウザコンソールで CORS エラーがないことを確認

### ローカルで認証が動作しない

1. すべての `DATABRICKS_*` 変数が `.env` に設定されていることを確認
2. `.env` を変更した後、Vite 開発サーバーを再起動
3. ブラウザの開発ツールでヘッダー注入を確認

## 関連リソース

- [デプロイガイド](./deployment.md) - Databricks Apps へのデプロイ
- [フロントエンドガイドライン](../../apps/web/CLAUDE.md) - React と UI 開発
- [バックエンドガイドライン](../../apps/api/CLAUDE.md) - API とデータベース開発
