# Frontend Application

React 19 + Vite 7 frontend for the AI chat application.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 19.0.0 |
| Build Tool | Vite 7.2.0 |
| Styling | Tailwind CSS 3.4.1 |
| UI Components | shadcn/ui (Radix UI based) |
| Internationalization | i18next, react-i18next |
| Routing | react-router-dom 7.x |
| Icons | lucide-react |

## Directory Structure

```
src/
├── components/
│   ├── layout/        # Layout components (AppLayout)
│   ├── main/          # Main area (MessageArea, InputArea)
│   ├── settings/      # Settings (UserSettingsModal)
│   ├── sidebar/       # Sidebar (SessionList, ModelSelector)
│   └── ui/            # shadcn/ui components
├── constants/         # Constants (models, layout)
├── contexts/          # React Context (UserContext)
├── hooks/             # Custom hooks (useUser)
├── i18n/              # Internationalization (en.json, ja.json)
├── lib/               # Utilities (cn, etc.)
└── services/          # API services (api-client, session, user)
```

## Component Patterns

### Functional Components + TypeScript

```typescript
// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}

// Bad - Don't use any types or PropTypes
function Button({ label, onClick }: any) { /* ... */ }
```

### Using Context

```typescript
import { useUser } from '@/hooks/useUser';

function MyComponent() {
  const { user, isLoading } = useUser();
  // ...
}
```

## Tailwind CSS

### Use cn() Utility

```typescript
import { cn } from '@/lib/utils';

// Good - Use cn() for conditional classes
<button className={cn(
  "px-4 py-2 rounded-md",
  variant === 'primary' && "bg-primary text-white",
  disabled && "opacity-50 cursor-not-allowed"
)}>

// Bad - String concatenation
<button className={`px-4 py-2 ${variant === 'primary' ? 'bg-primary' : ''}`}>
```

### Class Order

1. Layout (flex, grid)
2. Spacing (p-*, m-*)
3. Sizing (w-*, h-*)
4. Typography (text-*, font-*)
5. Colors (bg-*, text-*)
6. Effects (shadow-*, rounded-*)

## shadcn/ui

### Adding Components

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
```

### Usage

```typescript
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
```

## Internationalization (i18n)

### Translation Files

- `src/i18n/locales/en.json` - English
- `src/i18n/locales/ja.json` - Japanese

### Usage

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  return <span>{t('common.submit')}</span>;
}
```

## API Integration

### API Client

```typescript
import { apiClient } from '@/services/api-client';
import type { UserResponse } from '@repo/types';

// Type-safe API call
const user = await apiClient.get<UserResponse>('/api/user');
```

### Error Handling

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

## Path Aliases

`@/` maps to `src/`:

```typescript
// Good
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Bad - Deep relative paths
import { Button } from '../../components/ui/button';
```

## Environment Variables

Vite exposes environment variables with `VITE_` prefix:

```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

## Development

### Local Development

```bash
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run preview          # Preview build
```

### API Proxy

In development, `/api/*` is proxied to `http://localhost:8000`:

```typescript
fetch('/api/health');  // -> http://localhost:8000/api/health
```

## Troubleshooting

### Tailwind Classes Not Working

1. Check content paths in `tailwind.config.ts`
2. Verify Tailwind directives in `index.css`
3. Restart dev server

### shadcn/ui Component Not Found

1. Install component: `npx shadcn@latest add <component>`
2. Check import path is `@/components/ui/`

### Type Errors

1. Verify `@repo/types` is built
2. Restart TypeScript server in editor
