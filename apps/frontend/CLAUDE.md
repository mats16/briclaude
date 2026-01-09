# Frontend Application

React 19 + Vite 7 で構築された AI チャットアプリケーションのフロントエンド。

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | React 19.0.0 |
| ビルドツール | Vite 7.2.0 |
| スタイリング | Tailwind CSS 3.4.1 |
| UI コンポーネント | shadcn/ui (Radix UI ベース) |
| 国際化 | i18next, react-i18next |
| ルーティング | react-router-dom 7.x |
| アイコン | lucide-react |

## ディレクトリ構造

```
src/
├── components/
│   ├── layout/        # レイアウトコンポーネント (AppLayout)
│   ├── main/          # メインエリア (MessageArea, InputArea)
│   ├── settings/      # 設定関連 (UserSettingsModal)
│   ├── sidebar/       # サイドバー (SessionList, ModelSelector)
│   └── ui/            # shadcn/ui コンポーネント
├── constants/         # 定数定義 (models, layout)
├── contexts/          # React Context (UserContext)
├── hooks/             # カスタムフック (useUser)
├── i18n/              # 国際化 (en.json, ja.json)
├── lib/               # ユーティリティ (cn, etc.)
└── services/          # API サービス (api-client, session, user)
```

## コンポーネントパターン

### 関数コンポーネント + TypeScript

```typescript
// ✅ Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}

// ❌ Bad - any 型や PropTypes を使用しない
function Button({ label, onClick }: any) { /* ... */ }
```

### Context の使用

```typescript
import { useUser } from '@/hooks/useUser';

function MyComponent() {
  const { user, isLoading } = useUser();
  // ...
}
```

## Tailwind CSS

### cn() ユーティリティを使用

```typescript
import { cn } from '@/lib/utils';

// ✅ Good - 条件付きクラスには cn() を使用
<button className={cn(
  "px-4 py-2 rounded-md",
  variant === 'primary' && "bg-primary text-white",
  disabled && "opacity-50 cursor-not-allowed"
)}>

// ❌ Bad - 文字列連結
<button className={`px-4 py-2 ${variant === 'primary' ? 'bg-primary' : ''}`}>
```

### クラスの並び順

1. レイアウト (flex, grid)
2. スペーシング (p-*, m-*)
3. サイズ (w-*, h-*)
4. タイポグラフィ (text-*, font-*)
5. 色 (bg-*, text-*)
6. エフェクト (shadow-*, rounded-*)

## shadcn/ui

### コンポーネントの追加

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
```

### 使用方法

```typescript
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
```

## 国際化 (i18n)

### 翻訳ファイル

- `src/i18n/locales/en.json` - 英語
- `src/i18n/locales/ja.json` - 日本語

### 使用方法

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <span>{t('common.submit')}</span>;
}
```

## API 連携

### API クライアント

```typescript
import { apiClient } from '@/services/api-client';
import type { UserResponse } from '@repo/types';

// 型安全な API 呼び出し
const user = await apiClient.get<UserResponse>('/api/user');
```

### エラーハンドリング

```typescript
try {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data: HealthCheckResponse = await response.json();
  return data;
} catch (error) {
  console.error('Failed to fetch:', error);
}
```

## パスエイリアス

`@/` は `src/` にマップ:

```typescript
// ✅ Good
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ❌ Bad - 深い相対パス
import { Button } from '../../components/ui/button';
```

## 環境変数

Vite は `VITE_` プレフィックス付きの環境変数を公開:

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

## 開発

### ローカル開発

```bash
npm run dev              # 開発サーバー起動 (port 3000)
npm run build            # 本番ビルド
npm run preview          # ビルドのプレビュー
```

### API プロキシ

開発時は `/api/*` が `http://localhost:8000` にプロキシ:

```typescript
fetch('/api/health');  // → http://localhost:8000/api/health
```

## トラブルシューティング

### Tailwind クラスが効かない

1. `tailwind.config.ts` の content パスを確認
2. `index.css` に Tailwind ディレクティブがあるか確認
3. 開発サーバーを再起動

### shadcn/ui コンポーネントが見つからない

1. コンポーネントをインストール: `npx shadcn@latest add <component>`
2. インポートパスが `@/components/ui/` になっているか確認

### 型エラー

1. `@repo/types` がビルドされているか確認
2. エディタの TypeScript サーバーを再起動
