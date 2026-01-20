# デプロイガイド

このガイドでは、BriClaude を Databricks Apps にデプロイする方法を説明します。

## 前提条件

- Databricks CLI がインストール・設定済みであること
- Apps が有効な Databricks ワークスペースへのアクセス
- PostgreSQL 互換データベース（Lakebase 推奨）

## 1. データベースのセットアップ

### 1.1 データベースインスタンスの作成

Databricks Lakebase または外部の PostgreSQL インスタンスを用意します。

- **Databricks Lakebase（推奨）:** Databricks コンソールから Lakebase インスタンスを作成
- **外部の PostgreSQL:** ネットワーク設定により、Databricks Apps からアクセス可能であることを確認

### 1.2 データベースの作成

PostgreSQL インスタンスに接続し、アプリケーション用のデータベースを作成します。

```sql
CREATE DATABASE briclaude;
```

### 1.3 アプリケーション用ユーザーの作成

アプリケーション専用のデータベースユーザーを作成し、データベースの owner 権限を付与します。

```sql
-- アプリケーションユーザーを作成（RLS バイパスを明示的に無効化）
CREATE USER briclaude_user WITH PASSWORD 'your-secure-password' NOBYPASSRLS;

-- データベースの owner 権限を付与
ALTER DATABASE briclaude OWNER TO briclaude_user;
```

**重要:** このアプリケーションは Row-Level Security (RLS) を使用し、`current_setting('app.user_id', true)` でユーザーを識別します。アプリケーションは各リクエストでこのセッション変数を設定し、ユーザー分離を強制します。`NOBYPASSRLS` オプションにより、アプリケーションユーザーが RLS ポリシーをバイパスできないことが保証され、追加のセキュリティレイヤーが提供されます。

### 1.4 データベースマイグレーション

データベースマイグレーションはサーバー起動時に自動的に適用されます。デプロイ時に手動でマイグレーションを実行する必要はありません。

**ローカル開発または手動マイグレーションの場合:**

```bash
# データベース URL を設定
export DATABASE_URL="postgresql://admin:password@host:5432/briclaude"

# api ディレクトリに移動
cd apps/api

# マイグレーションファイルを生成（スキーマ変更時）
npm run db:generate

# 手動でマイグレーションを適用（オプション）
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
databricks secrets put-secret briclaude-dev database-url --string-value "postgresql://briclaude_user:password@host:5432/briclaude"

# 本番環境
databricks secrets put-secret briclaude-prod database-url --string-value "postgresql://briclaude_user:password@host:5432/briclaude"
```

**暗号化キー:**

機密データ（OAuth トークンなど）を暗号化するための安全な暗号化キーを生成します。32 バイト（64 文字の 16 進数）のランダムキーが必要です。

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

### 3.1 バンドル設定の検証

```bash
databricks bundle validate --target [dev|prod]
```

### 3.2 Databricks へのデプロイ

```bash
databricks bundle deploy --target [dev|prod]
```

### 3.3 アプリケーションの起動

```bash
databricks bundle run --target [dev|prod] briclaude_app
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

1. データベースユーザーが owner 権限を持っていることを確認
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
