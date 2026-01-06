# Claude Code on Databricks - Development Guide

## Project Overview

This is a monorepo containing a React frontend and Fastify backend for a Claude Code-like application on Databricks Apps. The project uses Turborepo for build orchestration and npm workspaces for dependency management.

## Architecture

```
claude-code-on-databricks/
├── apps/
│   ├── frontend/     # React 19 + Vite 7 + shadcn/ui
│   └── backend/      # Fastify 5 API server
└── packages/
    ├── types/        # Shared TypeScript type definitions
    ├── eslint-config/        # Shared ESLint configuration
    └── typescript-config/    # Shared TypeScript configuration
```

## Technology Stack

- **Language**: TypeScript 5.8+
- **Frontend**: React 19, Vite 7, Tailwind CSS, shadcn/ui
- **Backend**: Fastify 5
- **Monorepo**: Turborepo 2.x, npm workspaces
- **Code Quality**: ESLint 9 (Flat Config), Prettier
- **Runtime**: Node.js 22.12+ (LTS)

## Development Workflow

### Commands

```bash
# Install dependencies
npm install

# Start all apps in development mode
npm run dev

# Build all packages
npm run build

# Run linter
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Working with Individual Apps

```bash
# Frontend only
npm run dev --filter=@repo/frontend

# Backend only
npm run dev --filter=@repo/backend

# Build types package
npm run build --filter=@repo/types
```

## Code Style & Best Practices

### General Guidelines

1. **TypeScript First**: All code must be written in TypeScript with strict mode enabled
2. **Type Safety**: Never use `any` - use `unknown` or proper types
3. **Shared Types**: API types must be defined in `packages/types` and shared between frontend and backend
4. **ESLint**: Follow ESLint 9 Flat Config rules - no unused variables, proper imports
5. **Prettier**: All code must be formatted with Prettier before committing

### File Naming

- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Types**: PascalCase with `.ts` extension (e.g., `UserTypes.ts`)
- **Config**: kebab-case (e.g., `eslint.config.js`)

### Import Order

1. External libraries (React, etc.)
2. Internal packages (`@repo/*`)
3. Relative imports (`./`, `../`)
4. Type imports (use `import type`)

```typescript
import { useState } from 'react';
import type { HealthCheckResponse } from '@repo/types';
import { formatDate } from './utils';
```

## Type Sharing

Types are shared between frontend and backend through the `@repo/types` package:

```typescript
// packages/types/src/api.ts
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
}

// Backend usage
import type { HealthCheckResponse } from '@repo/types';

// Frontend usage
import type { HealthCheckResponse } from '@repo/types';
```

## Important Notes

### ESLint 9 Flat Config

This project uses ESLint 9 with Flat Config (`eslint.config.js`). Do NOT use legacy `.eslintrc.*` files.

### React 19

- PropTypes are deprecated and ignored
- Use TypeScript for type checking instead
- Prefer functional components with hooks

### Vite 7

- Node.js 22.12+ is required
- Use `import.meta.env` for environment variables
- Proxy setup: `/api` → `http://localhost:3001` (development only)

### Fastify 5

- Node.js 22+ recommended (20+ supported)
- All deprecated APIs from v4 have been removed
- Use TypeScript generics for route typing

### Turborepo

- Build tasks automatically resolve dependencies
- Cache is stored in `.turbo/` (git-ignored)
- Use `--force` to bypass cache if needed

## API Development

### Adding a New Endpoint

1. Define types in `packages/types/src/api.ts`
2. Implement route in `apps/backend/src/routes/`
3. Register route in `apps/backend/src/app.ts`
4. Use types in frontend for API calls

Example:

```typescript
// 1. Define type
export interface UserResponse {
  id: string;
  name: string;
  email: string;
}

// 2. Backend route
fastify.get<{ Reply: UserResponse }>('/user/:id', async (request, reply) => {
  const user: UserResponse = { /* ... */ };
  return reply.send(user);
});

// 3. Frontend usage
const response = await fetch(`/api/user/${id}`);
const user: UserResponse = await response.json();
```

## shadcn/ui Components

### Installing Components

```bash
cd apps/frontend
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
```

### Usage

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
```

### Customization

- Tailwind config: `apps/frontend/tailwind.config.ts`
- Component config: `apps/frontend/components.json`
- Theme variables: `apps/frontend/src/index.css`

## Testing (Future)

When adding tests:
- Use Vitest for unit tests
- Use Testing Library for React component tests
- Place tests next to source files with `.test.ts` or `.spec.ts` extension

## Deployment

### Databricks Apps (Future)

- Use asset bundles for deployment
- Environment variables must be set in Databricks workspace
- Build artifacts: `apps/frontend/dist`, `apps/backend/dist`

## Common Tasks

### Adding a New Dependency

```bash
# Frontend
cd apps/frontend
npm install <package-name>

# Backend
cd apps/backend
npm install <package-name>

# Shared types
cd packages/types
npm install <package-name>
```

### Updating Dependencies

```bash
# Update all workspaces
npm update

# Check for outdated packages
npm outdated
```

### Cleaning Build Artifacts

```bash
# Clean all packages
npm run clean

# Rebuild from scratch
npm run clean && npm install && npm run build
```

## Troubleshooting

### Build Failures

1. Ensure `@repo/types` is built first: `npm run build --filter=@repo/types`
2. Clear Turborepo cache: `rm -rf .turbo`
3. Clear node_modules: `npm run clean && npm install`

### Type Errors

1. Check that types package is built and up-to-date
2. Restart TypeScript server in your editor
3. Run `npm run type-check` to see all errors

### CORS Errors

1. Check `apps/backend/.env` has correct `CORS_ORIGIN`
2. Ensure backend is running on port 3001
3. Check Vite proxy configuration in `apps/frontend/vite.config.ts`

## Additional Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Fastify v5 Documentation](https://fastify.dev/docs/v5.2.x/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [Vite Documentation](https://vite.dev/)
- [React 19 Documentation](https://react.dev/)

## App-Specific Guidelines

For detailed guidelines specific to each application, see:
- Frontend: [apps/frontend/CLAUDE.md](./apps/frontend/CLAUDE.md)
- Backend: [apps/backend/CLAUDE.md](./apps/backend/CLAUDE.md)
