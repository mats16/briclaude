# Claude Code on Databricks

Claude Code-like application on Databricks Apps - React + Fastify モノレポ

## 概要

React 19 + shadcn/ui のフロントエンドと Fastify 5 によるバックエンド API のモノレポです。
Turborepo + npm workspaces で管理され、TypeScript により型安全性を確保しています。

## 技術スタック

| カテゴリ       | 技術                             |
| -------------- | -------------------------------- |
| モノレポ管理   | Turborepo, npm workspaces        |
| 言語           | TypeScript 5.8+                  |
| フロントエンド | React 19, Vite 7                 |
| UI ライブラリ  | shadcn/ui, Tailwind CSS          |
| バックエンド   | Fastify 5                        |
| コード品質     | ESLint 9 (Flat Config), Prettier |
| 必須環境       | Node.js 22.16 (LTS)              |

## プロジェクト構造

```
claude-code-on-databricks/
├── apps/
│   ├── frontend/          # React + Vite + shadcn/ui
│   └── backend/           # Fastify API
├── packages/
│   ├── types/             # @repo/types - 共通の型定義
│   ├── eslint-config/     # ESLint 共通設定
│   └── typescript-config/ # TypeScript 共通設定
├── package.json           # ルート - workspaces 定義
└── turbo.json             # Turborepo 設定
```

## セットアップ

### 必須要件

- Node.js 22.16 (LTS)
- npm 10.0+

### インストール

```bash
# 依存関係のインストール
npm install

# 型パッケージのビルド
npm run build --filter=@repo/types
```

### shadcn/ui コンポーネントの追加（オプション）

```bash
cd apps/frontend

# Button コンポーネント
npx shadcn-ui@latest add button

# Card コンポーネント
npx shadcn-ui@latest add card
```

## 開発

### 開発サーバー起動

```bash
# すべてのアプリを並列起動 (Turborepo)
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

### 個別起動

```bash
# バックエンドのみ
npm run dev --filter=@repo/backend

# フロントエンドのみ
npm run dev --filter=@repo/frontend
```

## ビルド

```bash
# すべてをビルド (依存関係を自動解決)
npm run build

# ビルド順序: @repo/types → @repo/backend → @repo/frontend
```

## コード品質

### リント

```bash
# すべてのパッケージをリント
npm run lint
```

### フォーマット

```bash
# フォーマット適用
npm run format

# フォーマットチェック
npm run format:check
```

### 型チェック

```bash
# 型チェック実行
npm run type-check
```

## API 連携

### 開発環境

- Vite のプロキシ設定により `/api/*` は自動的に `http://localhost:8000` に転送
- フロントエンドから `fetch('/api/health')` で API を呼び出し

### 本番環境

- 環境変数 `VITE_API_URL` で API の URL を指定
- バックエンドの CORS 設定でフロントエンドの URL を許可

## 型共有

`@repo/types` パッケージを通じて、フロントエンドとバックエンド間で型を共有します。

```typescript
// packages/types/src/api.ts で定義
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
}

// バックエンドとフロントエンドで使用
import type { HealthCheckResponse } from '@repo/types';
```

## Databricks Apps へのデプロイ

このプロジェクトは Databricks Apps へのデプロイに対応しており、Databricks Asset Bundle を使用して管理されます。

### 前提条件

- [Databricks CLI](https://docs.databricks.com/dev-tools/cli/index.html) がインストールされていること
- Databricks ワークスペースへの認証が設定されていること
- 適切な権限（アプリ作成、シークレット管理、SQL Warehouse 作成）があること

### シークレットの作成

デプロイ前に、以下のシークレットを作成する必要があります。

#### 1. シークレットスコープの作成

```bash
databricks secrets create-scope claude-code-app
```

#### 2. 必須シークレットの設定

**encryption-key** (アプリケーションの暗号化キー):

```bash
databricks secrets put-secret claude-code-app encryption-key
```

コマンド実行後、エディタが開きます。暗号化キーを入力して保存してください。

**database-url** (データベース接続文字列):

```bash
databricks secrets put-secret claude-code-app database-url
```

コマンド実行後、エディタが開きます。データベース接続文字列を入力して保存してください。

例: `postgresql://user:password@host:5432/database`

#### 3. シークレットの確認

```bash
# スコープ内のシークレット一覧を確認
databricks secrets list-secrets claude-code-app
```

### デプロイ

#### 開発環境へのデプロイ

```bash
# ビルド
npm run build

# デプロイ
databricks bundle deploy
```

デプロイ先: `/Workspace/Users/{yourUserName}/.bundle/claude-code-app/dev`

#### 本番環境へのデプロイ

```bash
# ビルド
npm run build

# 本番環境にデプロイ
databricks bundle deploy --target prod
```

デプロイ先: `/Workspace/Shared/.bundle/claude-code-app/prod`

### デプロイされるリソース

- **Claude Code App**: メインアプリケーション
- **SQL Warehouse**: `claude-warehouse` (2X-Small, サーバーレス対応)
- **Secrets**: 暗号化キーとデータベース URL
- **Permissions**: `users` グループに `CAN_USE` 権限

### デプロイの確認

```bash
# デプロイ済みリソースの確認
databricks bundle validate

# アプリのステータス確認
databricks apps list
```

## クリーンアップ

```bash
# すべての node_modules と build 成果物を削除
npm run clean
```

## 次のステップ

- [ ] CI/CD パイプライン (GitHub Actions)
- [ ] Databricks Apps へのデプロイ設定 (asset bundles)
- [ ] 追加の shadcn/ui コンポーネント
- [ ] API エンドポイントの追加
- [ ] ルーティング (React Router)
- [ ] テストフレームワーク (Vitest, Testing Library)

## ライセンス

MIT
