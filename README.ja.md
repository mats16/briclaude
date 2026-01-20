# Claude Code on Databricks

[English](./README.md)

Databricks Apps 上で動作する Claude Code のような AI チャットアプリケーション - React + Fastify モノレポ

## 概要

React 19 + shadcn/ui のフロントエンドと Fastify 5 によるバックエンド API のモノレポです。
Turborepo + npm workspaces で管理され、TypeScript により型安全性を確保しています。

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| モノレポ管理 | Turborepo, npm workspaces |
| 言語 | TypeScript 5.8+ |
| フロントエンド | React 19, Vite 7, shadcn/ui, Tailwind CSS, i18next |
| バックエンド | Fastify 5, Drizzle ORM, Claude Agent SDK |
| コード品質 | ESLint 9 (Flat Config), Prettier |
| ランタイム | Node.js 22.16 (LTS) |

## プロジェクト構造

```
briclaude/
├── apps/
│   ├── web/               # React + Vite + shadcn/ui
│   └── api/               # Fastify API + Drizzle ORM
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
- PostgreSQL（バックエンド用）

### インストール

```bash
# 依存関係のインストール
npm install

# 型パッケージのビルド
npm run build --filter=@repo/types
```

### shadcn/ui コンポーネントの追加（オプション）

```bash
cd apps/web

# Button コンポーネント
npx shadcn@latest add button

# Card コンポーネント
npx shadcn@latest add card
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
npm run dev --filter=@repo/api

# フロントエンドのみ
npm run dev --filter=@repo/web
```

## ビルド

```bash
# すべてをビルド (依存関係を自動解決)
npm run build

# ビルド順序: @repo/types → @repo/api → @repo/web
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

## テスト

```bash
# バックエンドテスト実行
npm run test --filter=@repo/api

# ウォッチモード
npm run test:watch --filter=@repo/api

# カバレッジ
npm run test:coverage --filter=@repo/api
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

詳細なデプロイ手順については、[デプロイガイド](docs/ja/deployment.md)を参照してください。

## クリーンアップ

```bash
# すべての node_modules と build 成果物を削除
npm run clean
```

## ドキュメント

詳細な開発ガイドラインについては以下を参照:

- [CLAUDE.md](./CLAUDE.md) - プロジェクト概要とコーディング規約
- [apps/web/CLAUDE.md](./apps/web/CLAUDE.md) - フロントエンド開発ガイド
- [apps/api/CLAUDE.md](./apps/api/CLAUDE.md) - バックエンド開発ガイド

## ライセンス

MIT
