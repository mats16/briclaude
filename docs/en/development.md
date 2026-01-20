# Local Development Guide

This guide explains how to set up and run BriClaude locally for development.

## Prerequisites

- **Node.js**: 22.16 or higher (LTS)
- **npm**: 10.0.0 or higher
- **PostgreSQL**: 14 or higher (local or remote)
- **Git**: For version control

## Architecture Overview

In local development, the application runs with two servers:

```
┌────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────┐          ┌─────────────────────────┐ │
│  │ Vite Dev Server     │ headers  │ Fastify Backend         │ │
│  │ (port 3000)         │─────────▶│ (port 8000)             │ │
│  │ ├─ React HMR        │ emulated │ └─ /api/* (API routes)  │ │
│  │ └─ /api/* proxy     │          │                         │ │
│  └─────────────────────┘          └─────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

- **Vite Dev Server (port 3000)**: Serves the React frontend with Hot Module Replacement
- **Fastify Backend (port 8000)**: Handles API requests
- **API Proxy**: Vite automatically proxies `/api/*` requests to the backend and injects authentication headers

## 1. Repository Setup

### 1.1 Clone the Repository

```bash
git clone https://github.com/your-org/briclaude.git
cd briclaude
```

### 1.2 Install Dependencies

```bash
npm install
```

This installs dependencies for all workspaces (apps and packages).

## 2. Database Setup

### 2.1 Start PostgreSQL

**Using Docker (recommended):**

```bash
docker run -d \
  --name briclaude-postgres \
  -e POSTGRES_USER=briclaude_user \
  -e POSTGRES_PASSWORD=localdev \
  -e POSTGRES_DB=briclaude \
  -p 5432:5432 \
  postgres:16
```

**Using local PostgreSQL:**

```sql
-- Create user
CREATE ROLE briclaude_user WITH LOGIN PASSWORD 'localdev' NOBYPASSRLS;

-- Grant role to current user
GRANT briclaude_user TO CURRENT_USER WITH SET TRUE;

-- Create database
CREATE DATABASE briclaude OWNER briclaude_user;
```

### 2.2 Database Migrations

Migrations are automatically applied when the server starts. For manual migration:

```bash
cd apps/api

# Generate migration files (if schema changed)
npm run db:generate

# Apply migrations manually
npm run db:migrate

# Or push schema directly (development only)
npm run db:push
```

## 3. Environment Variables

### 3.1 Create .env File

Copy the example file and configure:

```bash
cp .env.example .env
```

### 3.2 Required Variables

Edit `.env` with your configuration:

```bash
# Server
PORT=8000
NODE_ENV=development

# Database (required)
DATABASE_URL=postgresql://briclaude_user:localdev@localhost:5432/briclaude

# Encryption (required - generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your-64-character-hex-key

# Databricks (required)
DATABRICKS_HOST=your-workspace.cloud.databricks.com

# Development: Databricks auth headers emulation (required for local auth)
DATABRICKS_TOKEN=your-personal-access-token
DATABRICKS_USER_NAME=your-name
DATABRICKS_USER_ID=your-user-id
DATABRICKS_USER_EMAIL=your-email@example.com
```

### 3.3 Optional Variables

```bash
# SQL Warehouse (if using Databricks SQL)
WAREHOUSE_ID=your-warehouse-id

# Anthropic API (defaults to Databricks serving endpoints)
ANTHROPIC_BASE_URL=https://your-workspace.databricks.com/serving-endpoints/anthropic
ANTHROPIC_DEFAULT_OPUS_MODEL=databricks-claude-opus-4-5
ANTHROPIC_DEFAULT_SONNET_MODEL=databricks-claude-sonnet-4-5
ANTHROPIC_DEFAULT_HAIKU_MODEL=databricks-claude-haiku-4-5

# User directories
USER_BASE_DIR=/path/to/user/directories
```

### 3.4 Generate Encryption Key

```bash
openssl rand -hex 32
```

Copy the output to your `.env` file as `ENCRYPTION_KEY`.

## 4. Start Development Servers

### 4.1 Start All Apps

```bash
npm run dev
```

This starts both frontend and backend in development mode:
- Frontend: http://localhost:3000
- Backend: http://localhost:8000

### 4.2 Start Individual Apps

```bash
# Frontend only
npm run dev --filter=@repo/web

# Backend only
npm run dev --filter=@repo/api
```

### 4.3 Access the Application

Open http://localhost:3000 in your browser.

## 5. Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all apps in development mode |
| `npm run build` | Build all packages |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run type-check` | Run TypeScript type checking |
| `npm run test` | Run tests |
| `npm run clean` | Clean build artifacts and node_modules |

### Working with Turborepo

```bash
# Build specific package
npm run build --filter=@repo/types

# Run dev for specific app
npm run dev --filter=@repo/api

# Force rebuild (bypass cache)
npm run build --force
```

### Database Commands (in apps/api)

```bash
cd apps/api

npm run db:generate   # Generate migration files from schema changes
npm run db:migrate    # Run pending migrations
npm run db:push       # Push schema directly (dev only)
npm run db:studio     # Open Drizzle Studio (database GUI)
```

## 6. Authentication in Development

In production, Databricks Apps proxy handles authentication and forwards user information via headers. In development, Vite emulates this by injecting headers from environment variables.

### How It Works

1. Vite dev server receives requests at port 3000
2. For `/api/*` requests, Vite proxies to backend (port 8000)
3. Vite injects Databricks-style headers using values from `.env`
4. Backend reads user info from headers as it would in production

### Headers Emulated

| Header | Environment Variable |
|--------|---------------------|
| `x-forwarded-user` | `DATABRICKS_USER_ID` |
| `x-forwarded-preferred-username` | `DATABRICKS_USER_NAME` |
| `x-forwarded-email` | `DATABRICKS_USER_EMAIL` |
| `x-forwarded-access-token` | `DATABRICKS_TOKEN` |

## 7. Project Structure

```
briclaude/
├── apps/
│   ├── web/               # React 19 + Vite 7 + shadcn/ui
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── contexts/    # React contexts
│   │   │   ├── hooks/       # Custom hooks
│   │   │   ├── i18n/        # Internationalization
│   │   │   └── services/    # API clients
│   │   └── CLAUDE.md        # Frontend guidelines
│   └── api/               # Fastify 5 + Drizzle ORM
│       ├── src/
│       │   ├── db/          # Database schema
│       │   ├── plugins/     # Fastify plugins
│       │   ├── routes/      # API routes
│       │   ├── services/    # Business logic
│       │   └── utils/       # Utilities
│       └── CLAUDE.md        # Backend guidelines
└── packages/
    ├── types/             # Shared TypeScript types
    ├── eslint-config/     # Shared ESLint config
    └── typescript-config/ # Shared TypeScript config
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000  # or :8000

# Kill process
kill -9 <PID>
```

### Type Errors After Schema Changes

1. Build the types package first:
   ```bash
   npm run build --filter=@repo/types
   ```

2. Restart your TypeScript server in your editor

### Database Connection Failed

1. Verify PostgreSQL is running:
   ```bash
   docker ps  # If using Docker
   pg_isready -h localhost -p 5432  # Check connection
   ```

2. Check `DATABASE_URL` in `.env` is correct

3. Ensure database exists:
   ```bash
   psql -h localhost -U briclaude_user -d briclaude -c "SELECT 1"
   ```

### Turborepo Cache Issues

```bash
# Clear Turborepo cache
rm -rf .turbo

# Full clean and reinstall
npm run clean && npm install
```

### API Proxy Not Working

1. Ensure backend is running on port 8000
2. Check Vite config in `apps/web/vite.config.ts`
3. Verify no CORS errors in browser console

### Authentication Not Working Locally

1. Ensure all `DATABRICKS_*` variables are set in `.env`
2. Restart Vite dev server after changing `.env`
3. Check browser dev tools for header injection

## Additional Resources

- [Deployment Guide](./deployment.md) - Deploy to Databricks Apps
- [Frontend Guidelines](../../apps/web/CLAUDE.md) - React and UI development
- [Backend Guidelines](../../apps/api/CLAUDE.md) - API and database development
