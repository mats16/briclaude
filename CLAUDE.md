# Claude Code on Databricks

Databricks Apps 上で動作する Claude Code のような AI チャットアプリケーションのモノレポ。

## アーキテクチャ

```
claude-code-on-databricks/
├── apps/
│   ├── frontend/          # React 19 + Vite 7 + shadcn/ui
│   └── backend/           # Fastify 5 + Drizzle ORM + Claude Agent SDK
└── packages/
    ├── types/             # 共有 TypeScript 型定義
    ├── eslint-config/     # 共有 ESLint 設定
    └── typescript-config/ # 共有 TypeScript 設定
```

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| 言語 | TypeScript 5.8+ (strict mode) |
| フロントエンド | React 19, Vite 7, Tailwind CSS, shadcn/ui, i18next |
| バックエンド | Fastify 5, Drizzle ORM, Claude Agent SDK |
| モノレポ | Turborepo 2.x, npm workspaces |
| コード品質 | ESLint 9 (Flat Config), Prettier |
| ランタイム | Node.js 22.16 (LTS) |

## 開発コマンド

```bash
npm install          # 依存関係をインストール
npm run dev          # 全アプリを開発モードで起動
npm run build        # 全パッケージをビルド
npm run lint         # リンターを実行
npm run format       # コードをフォーマット
npm run type-check   # 型チェック
```

### 個別アプリの操作

```bash
npm run dev --filter=@repo/frontend   # フロントエンドのみ
npm run dev --filter=@repo/backend    # バックエンドのみ
npm run build --filter=@repo/types    # types パッケージをビルド
```

## コードスタイル

### 必須ルール

- **TypeScript First**: 全コードは TypeScript で記述（`any` 禁止、`unknown` または適切な型を使用）
- **共有型**: API 型は `packages/types` で定義し、フロントエンド・バックエンド間で共有
- **ESLint 9 Flat Config**: `.eslintrc.*` は使用しない（`eslint.config.js` のみ）
- **Prettier**: コミット前にフォーマット必須

### ファイル命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| コンポーネント | PascalCase | `UserProfile.tsx` |
| ユーティリティ | camelCase | `formatDate.ts` |
| 型定義 | PascalCase | `UserTypes.ts` |
| 設定ファイル | kebab-case | `eslint.config.js` |

### インポート順序

```typescript
// 1. 外部ライブラリ
import { useState } from 'react';

// 2. 内部パッケージ
import type { HealthCheckResponse } from '@repo/types';

// 3. 相対インポート
import { formatDate } from './utils';
```

## 型の共有

`@repo/types` パッケージで API 型を定義し、フロントエンド・バックエンド間で共有:

```typescript
// packages/types/src/api.ts
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
}

// 使用側（フロントエンド・バックエンド共通）
import type { HealthCheckResponse } from '@repo/types';
```

## API 開発フロー

新しいエンドポイントを追加する手順:

1. `packages/types/src/` に型を定義
2. `apps/backend/src/routes/` にルートを実装
3. `apps/backend/src/app.ts` でルートを登録
4. フロントエンドで型を使用して API を呼び出し

## 重要な注意事項

### Turborepo

- ビルドタスクは依存関係を自動解決
- キャッシュは `.turbo/` に保存（git-ignored）
- キャッシュをバイパスするには `--force` を使用

### ビルドエラーの対処

1. `@repo/types` を先にビルド: `npm run build --filter=@repo/types`
2. Turborepo キャッシュをクリア: `rm -rf .turbo`
3. node_modules を再インストール: `npm run clean && npm install`

## アプリ固有のガイドライン

詳細なガイドラインは各アプリの CLAUDE.md を参照:

- **フロントエンド**: [apps/frontend/CLAUDE.md](./apps/frontend/CLAUDE.md)
  - React 19, shadcn/ui, Tailwind CSS の使い方
  - コンポーネント設計パターン
  - i18n 対応

- **バックエンド**: [apps/backend/CLAUDE.md](./apps/backend/CLAUDE.md)
  - Fastify 5 ルーティング
  - Drizzle ORM とデータベース操作
  - Claude Agent SDK の使用方法
  - プラグインシステム
