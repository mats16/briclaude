# Claude Code on Databricks

A monorepo for a Claude Code-like AI chat application running on Databricks Apps.

## Architecture

```
claude-code-on-databricks/
├── apps/
│   ├── frontend/          # React 19 + Vite 7 + shadcn/ui
│   └── backend/           # Fastify 5 + Drizzle ORM + Claude Agent SDK
└── packages/
    ├── types/             # Shared TypeScript type definitions
    ├── eslint-config/     # Shared ESLint configuration
    └── typescript-config/ # Shared TypeScript configuration
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript 5.8+ (strict mode) |
| Frontend | React 19, Vite 7, Tailwind CSS, shadcn/ui, i18next |
| Backend | Fastify 5, Drizzle ORM, Claude Agent SDK |
| Monorepo | Turborepo 2.x, npm workspaces |
| Code Quality | ESLint 9 (Flat Config), Prettier |
| Runtime | Node.js 22.16 (LTS) |

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start all apps in development mode
npm run build        # Build all packages
npm run lint         # Run linter
npm run format       # Format code
npm run type-check   # Type check
```

### Working with Individual Apps

```bash
npm run dev --filter=@repo/frontend   # Frontend only
npm run dev --filter=@repo/backend    # Backend only
npm run build --filter=@repo/types    # Build types package
```

## Code Style

### Required Rules

- **TypeScript First**: All code must be written in TypeScript (no `any`, use `unknown` or proper types)
- **Shared Types**: API types must be defined in `packages/types` and shared between frontend and backend
- **ESLint 9 Flat Config**: Do not use `.eslintrc.*` (only `eslint.config.js`)
- **Prettier**: Format code before committing

### File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| Type Definitions | PascalCase | `UserTypes.ts` |
| Config Files | kebab-case | `eslint.config.js` |

### Import Order

```typescript
// 1. External libraries
import { useState } from 'react';

// 2. Internal packages
import type { HealthCheckResponse } from '@repo/types';

// 3. Relative imports
import { formatDate } from './utils';
```

## Type Sharing

Define API types in `@repo/types` package and share between frontend and backend:

```typescript
// packages/types/src/api.ts
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
}

// Usage (both frontend and backend)
import type { HealthCheckResponse } from '@repo/types';
```

## API Development Flow

Steps to add a new endpoint:

1. Define types in `packages/types/src/`
2. Implement route in `apps/backend/src/routes/`
3. Register route in `apps/backend/src/app.ts`
4. Use types in frontend to call the API

## Important Notes

### Turborepo

- Build tasks automatically resolve dependencies
- Cache is stored in `.turbo/` (git-ignored)
- Use `--force` to bypass cache

### Troubleshooting Build Errors

1. Build `@repo/types` first: `npm run build --filter=@repo/types`
2. Clear Turborepo cache: `rm -rf .turbo`
3. Reinstall node_modules: `npm run clean && npm install`

## App-Specific Guidelines

See each app's CLAUDE.md for detailed guidelines:

- **Frontend**: [apps/frontend/CLAUDE.md](./apps/frontend/CLAUDE.md)
  - React 19, shadcn/ui, Tailwind CSS usage
  - Component design patterns
  - i18n support

- **Backend**: [apps/backend/CLAUDE.md](./apps/backend/CLAUDE.md)
  - Fastify 5 routing
  - Drizzle ORM and database operations
  - Claude Agent SDK usage
  - Plugin system
