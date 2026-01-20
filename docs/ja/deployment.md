# デプロイガイド

このガイドでは、BriClaude を Databricks Apps にデプロイする方法を説明します。

## 前提条件

- Databricks CLI がインストール・設定済みであること
- Apps が有効な Databricks ワークスペースへのアクセス
- PostgreSQL 互換データベース（Lakebase 推奨）

## 1. データベースのセットアップ

### 1.1 データベースの作成

Lakebase または外部の PostgreSQL インスタンスに PostgreSQL 互換データベースを作成します。

**Databricks Lakebase を使用する場合（推奨）:**

```sql
-- データベースを作成
CREATE DATABASE briclaude;
```

**外部の PostgreSQL を使用する場合:**

ネットワーク設定により、Databricks Apps からデータベースにアクセス可能であることを確認してください。

### 1.2 アプリケーション用ユーザーの作成

適切な権限を持つ、アプリケーション専用のデータベースユーザーを作成します。

```sql
-- アプリケーションユーザーを作成（RLS バイパスを明示的に無効化）
CREATE USER briclaude_app WITH PASSWORD 'your-secure-password' NOBYPASSRLS;

-- 接続権限を付与
GRANT CONNECT ON DATABASE briclaude TO briclaude_app;

-- スキーマ権限を付与
GRANT USAGE ON SCHEMA public TO briclaude_app;

-- テーブル権限を付与（マイグレーション実行後）
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO briclaude_app;

-- シーケンス権限を付与
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO briclaude_app;

-- 今後作成されるテーブルへのデフォルト権限を設定
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO briclaude_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO briclaude_app;
```

**重要:** このアプリケーションは Row-Level Security (RLS) を使用し、`current_setting('app.user_id', true)` でユーザーを識別します。アプリケーションは各リクエストでこのセッション変数を設定し、ユーザー分離を強制します。`NOBYPASSRLS` オプションにより、アプリケーションユーザーが RLS ポリシーをバイパスできないことが保証され、追加のセキュリティレイヤーが提供されます。

### 1.3 データベースマイグレーションの実行

`DATABASE_URL` 環境変数を設定し、マイグレーションを実行します。

```bash
# データベース URL を設定（マイグレーション用に管理者ユーザーを使用）
export DATABASE_URL="postgresql://admin:password@host:5432/briclaude"

# api ディレクトリに移動
cd apps/api

# マイグレーションファイルを生成（スキーマ変更時）
npm run db:generate

# マイグレーションを適用
npm run db:migrate
```

## 2. シークレットの設定

Databricks シークレットスコープを作成し、必要なシークレットを追加します。

### 2.1 シークレットスコープの作成

```bash
# 開発環境用
databricks secrets create-scope briclaude-dev

# 本番環境用
databricks secrets create-scope briclaude-prod
```

### 2.2 必要なシークレットの追加

**データベース URL:**

```bash
# 開発環境
databricks secrets put-secret briclaude-dev database-url --string-value "postgresql://briclaude_app:password@host:5432/briclaude"

# 本番環境
databricks secrets put-secret briclaude-prod database-url --string-value "postgresql://briclaude_app:password@host:5432/briclaude"
```

**暗号化キー:**

機密データ（OAuth トークンなど）を暗号化するための安全な 32 バイトの暗号化キーを生成します。

```bash
# 暗号化キーを生成
ENCRYPTION_KEY=$(openssl rand -hex 32)

# 開発環境
databricks secrets put-secret briclaude-dev encryption-key --string-value "$ENCRYPTION_KEY"

# 本番環境
databricks secrets put-secret briclaude-prod encryption-key --string-value "$ENCRYPTION_KEY"
```

## 3. Asset Bundles によるデプロイ

> **注意:** Databricks Asset Bundles を使用したこのデプロイ方法は、Lakebase サポートがバンドル設定で利用可能になるまでの暫定的な対応です。Lakebase 統合がサポートされると、データベースとユーザーの作成手順はバンドルリソースを通じて自動化される可能性があります。

### 3.1 アプリケーションのビルド

```bash
# 依存関係をインストール
npm install

# 全パッケージをビルド
npm run build
```

### 3.2 バンドル設定の検証

```bash
# 開発デプロイを検証
databricks bundle validate --target dev

# 本番デプロイを検証
databricks bundle validate --target prod
```

### 3.3 Databricks へのデプロイ

**開発環境へのデプロイ:**

```bash
databricks bundle deploy --target dev
```

**本番環境へのデプロイ:**

```bash
databricks bundle deploy --target prod
```

### 3.4 デプロイの確認

デプロイ後、アプリケーションのステータスを確認します。

```bash
# デプロイされたアプリを一覧表示
databricks apps list

# アプリの詳細を取得
databricks apps get briclaude-dev-<user-id>
```

## 4. デプロイ後の検証

### 4.1 アプリケーションのヘルスチェック

ヘルスエンドポイントにアクセスして、アプリケーションが実行されていることを確認します。

```bash
curl https://<workspace-url>/apps/<app-name>/api/health
```

期待されるレスポンス:

```json
{
  "status": "ok",
  "timestamp": "2026-01-20T00:00:00.000Z",
  "service": "briclaude-api"
}
```

### 4.2 データベース接続の確認

ヘルスエンドポイントはデータベース接続も検証します。データベースに問題がある場合、ステータスにエラーが表示されます。

## トラブルシューティング

### データベース接続の問題

1. シークレットのデータベース URL が正しいことを確認
2. Databricks Apps とデータベース間のネットワーク接続を確認
3. データベースユーザーが適切な権限を持っていることを確認

### マイグレーションの失敗

1. マイグレーションに管理者ユーザーを使用していることを確認
2. 競合する可能性のある既存のオブジェクトを確認
3. マイグレーション SQL ファイルにエラーがないか確認

### アプリケーション起動の問題

1. Databricks Apps コンソールでアプリケーションログを確認
2. 必要なすべてのシークレットが設定されていることを確認
3. デプロイ前にビルドが正常に完了していることを確認

## 環境別の設定

| 設定 | 開発環境 | 本番環境 |
|------|----------|----------|
| バンドルターゲット | `dev` | `prod` |
| シークレットスコープ | `briclaude-dev` | `briclaude-prod` |
| アプリ名 | `briclaude-dev-<user-id>` | `briclaude-prod` |
| ワークスペースパス | `/Workspace/Users/<user>/.bundle/...` | `/Workspace/Shared/.bundle/...` |

## セキュリティに関する考慮事項

1. **データベース認証情報:** 管理者アカウントではなく、必ず専用のアプリケーションユーザーを使用
2. **暗号化キー:** 各環境に固有のキーを生成
3. **シークレットスコープ:** シークレットスコープへのアクセスを適切に制限
4. **ネットワークセキュリティ:** 可能な限りプライベートエンドポイントを設定
