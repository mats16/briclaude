# Claude Code on Databricks

[日本語](./README.ja.md)

A Claude Code-like AI chat application running on Databricks Apps - React + Fastify monorepo.

## Overview

A monorepo with React 19 + shadcn/ui frontend and Fastify 5 backend API.
Managed with Turborepo + npm workspaces, with type safety ensured through TypeScript.

## Tech Stack

| Category | Technology |
|----------|------------|
| Monorepo | Turborepo, npm workspaces |
| Language | TypeScript 5.8+ |
| Frontend | React 19, Vite 7, shadcn/ui, Tailwind CSS, i18next |
| Backend | Fastify 5, Drizzle ORM, Claude Agent SDK |
| Code Quality | ESLint 9 (Flat Config), Prettier |
| Runtime | Node.js 22.16 (LTS) |

## Project Structure

```
briclaude/
├── apps/
│   ├── web/               # React + Vite + shadcn/ui
│   └── api/               # Fastify API + Drizzle ORM
├── packages/
│   ├── types/             # @repo/types - Shared type definitions
│   ├── eslint-config/     # Shared ESLint config
│   └── typescript-config/ # Shared TypeScript config
├── package.json           # Root - workspaces definition
└── turbo.json             # Turborepo config
```

## Setup

### Prerequisites

- Node.js 22.16 (LTS)
- npm 10.0+
- PostgreSQL (for backend)

### Installation

```bash
# Install dependencies
npm install

# Build types package
npm run build --filter=@repo/types
```

### Adding shadcn/ui Components (Optional)

```bash
cd apps/web

# Button component
npx shadcn@latest add button

# Card component
npx shadcn@latest add card
```

## Development

### Start Development Servers

```bash
# Start all apps in parallel (Turborepo)
npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

### Start Individual Apps

```bash
# Backend only
npm run dev --filter=@repo/api

# Frontend only
npm run dev --filter=@repo/web
```

## Build

```bash
# Build all (dependencies auto-resolved)
npm run build

# Build order: @repo/types → @repo/api → @repo/web
```

## Code Quality

### Lint

```bash
# Lint all packages
npm run lint
```

### Format

```bash
# Apply formatting
npm run format

# Check formatting
npm run format:check
```

### Type Check

```bash
# Run type check
npm run type-check
```

## Testing

```bash
# Run backend tests
npm run test --filter=@repo/api

# Watch mode
npm run test:watch --filter=@repo/api

# Coverage
npm run test:coverage --filter=@repo/api
```

## API Integration

### Development

- Vite proxy automatically forwards `/api/*` to `http://localhost:8000`
- Call API from frontend with `fetch('/api/health')`

### Production

- Set API URL via `VITE_API_URL` environment variable
- Configure backend CORS to allow frontend URL

## Type Sharing

Share types between frontend and backend via `@repo/types` package.

```typescript
// Define in packages/types/src/api.ts
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
}

// Use in backend and frontend
import type { HealthCheckResponse } from '@repo/types';
```

## Deploying to Databricks Apps

This project supports deployment to Databricks Apps, managed via Databricks Asset Bundle.

### Prerequisites

- [Databricks CLI](https://docs.databricks.com/dev-tools/cli/index.html) installed
- Authenticated to Databricks workspace
- Required permissions (app creation, secret management, SQL Warehouse creation)

### Create Secrets

Before deployment, create secrets for each environment.

#### 1. Create Secret Scope

**Development:**

```bash
databricks secrets create-scope claude-code-app-dev
```

**Production:**

```bash
databricks secrets create-scope claude-code-app-prod
```

#### 2. Set Required Secrets

Set the following secrets for each environment.

**Development:**

```bash
# encryption-key (Application encryption key)
databricks secrets put-secret claude-code-app-dev encryption-key

# database-url (Database connection string)
databricks secrets put-secret claude-code-app-dev database-url
```

**Production:**

```bash
# encryption-key (Application encryption key)
databricks secrets put-secret claude-code-app-prod encryption-key

# database-url (Database connection string)
databricks secrets put-secret claude-code-app-prod database-url
```

After running the command, an editor opens. Enter and save the secret value.

Database connection string example: `postgresql://user:password@host:5432/database`

#### 3. Verify Secrets

```bash
# List development secrets
databricks secrets list-secrets claude-code-app-dev

# List production secrets
databricks secrets list-secrets claude-code-app-prod
```

### Deploy

#### Deploy to Development

```bash
# Build
npm run build

# Deploy
databricks bundle deploy
```

Deploy path: `/Workspace/Users/{yourUserName}/.bundle/claude-code-app/dev`

#### Deploy to Production

```bash
# Build
npm run build

# Deploy to production
databricks bundle deploy --target prod
```

Deploy path: `/Workspace/Shared/.bundle/claude-code-app/prod`

### Deployed Resources

- **Claude Code App**: Main application
- **SQL Warehouse**: `claude-warehouse` (2X-Small, serverless)
- **Secrets**: Encryption key and database URL
- **Permissions**: `CAN_USE` permission for `users` group

### Verify Deployment

```bash
# Validate deployed resources
databricks bundle validate

# Check app status
databricks apps list
```

## Cleanup

```bash
# Delete all node_modules and build artifacts
npm run clean
```

## Documentation

For detailed development guidelines, see:

- [CLAUDE.md](./CLAUDE.md) - Project overview and coding standards
- [apps/web/CLAUDE.md](./apps/web/CLAUDE.md) - Frontend development guide
- [apps/api/CLAUDE.md](./apps/api/CLAUDE.md) - Backend development guide

## License

MIT
