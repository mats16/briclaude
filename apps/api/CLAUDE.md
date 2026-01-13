# Backend Application

REST API server built with Fastify 5. Uses Drizzle ORM for database operations and Claude Agent SDK for AI features.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Fastify 5.2.0 |
| ORM | Drizzle ORM 1.0.0-beta |
| AI | Claude Agent SDK |
| Database | PostgreSQL (postgres.js) |
| Testing | Vitest |
| Development | tsx 4.x |

## Directory Structure

```
src/
├── db/                # Database (schema, helpers)
├── plugins/           # Fastify plugins
│   ├── config.ts      # Environment variables (@fastify/env)
│   ├── database.ts    # Database connection (Drizzle)
│   ├── request-context.ts  # Request context
│   ├── request-decorator.ts # Request decorator
│   └── static.ts      # Static file serving
├── routes/            # API routes
│   ├── health.ts      # Health check
│   ├── session.ts     # Session management
│   ├── user.ts        # User info
│   ├── user-tokens.ts # Token management
│   └── title.ts       # Title generation
├── services/          # Business logic
│   ├── session.service.ts
│   ├── title.service.ts
│   ├── token-resolver.service.ts
│   └── user.service.ts
├── utils/             # Utilities (encryption)
├── app.ts             # Fastify app setup
└── server.ts          # Server entry point
```

## Route Definition Pattern

Type-safe routes using TypeScript generics:

```typescript
import { FastifyPluginAsync } from 'fastify';
import type { HealthCheckResponse } from '@repo/types';

const healthRoute: FastifyPluginAsync = async fastify => {
  fastify.get<{ Reply: HealthCheckResponse }>('/health', async (request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'claude-code-on-databricks',
    });
  });
};

export default healthRoute;
```

### Request/Response Types

```typescript
fastify.post<{
  Params: { id: string };
  Querystring: { filter?: string };
  Body: CreateUserRequest;
  Reply: UserResponse;
}>('/users/:id', async (request, reply) => {
  const { id } = request.params;
  const { filter } = request.query;
  const { name, email } = request.body;
  // ...
});
```

## Plugin System

### Registration Order

```typescript
// app.ts
export async function build() {
  const app = Fastify({ logger: true });

  // 1. Config plugin
  await app.register(configPlugin);

  // 2. Database plugin
  await app.register(databasePlugin);

  // 3. Request decorator
  await app.register(requestDecoratorPlugin);

  // 4. API routes
  await app.register(healthRoute, { prefix: '/api' });
  await app.register(sessionRoute, { prefix: '/api' });

  // 5. Static file serving (last)
  await app.register(staticPlugin);

  return app;
}
```

### Request Context

Extract user info from Databricks Apps headers:

```typescript
fastify.get('/example', async (request, reply) => {
  const userId = request.ctx?.user.id;
  const userName = request.ctx?.user.name;
  const requestId = request.ctx?.requestId;
  // ...
});
```

| Header | Context | Fallback |
|--------|---------|----------|
| `x-forwarded-user` | `ctx.user.id` | Empty string |
| `x-forwarded-preferred-username` | `ctx.user.name` | Empty string |
| `x-forwarded-email` | `ctx.user.email` | Empty string |
| `x-forwarded-access-token` | `ctx.user.oboAccessToken` | Empty string |
| `x-request-id` | `ctx.requestId` | Generated UUID |

## Database (Drizzle ORM)

### Schema Definition

```typescript
// src/db/schema.ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Queries

```typescript
import { db } from '../plugins/database.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Select
const user = await db.select().from(users).where(eq(users.id, userId));

// Insert
await db.insert(users).values({ id, name, email });

// Update
await db.update(users).set({ name }).where(eq(users.id, userId));
```

### Migrations

```bash
npm run db:generate   # Generate migration files
npm run db:migrate    # Run migrations
npm run db:push       # Push schema directly
npm run db:studio     # Start Drizzle Studio
```

## Environment Variables

### Required

```bash
DATABASE_URL=postgresql://localhost:5432/mydb
ENCRYPTION_KEY=your-64-character-hex-key
DATABRICKS_HOST=your-workspace.databricks.com
```

### Optional

```bash
NODE_ENV=development          # development | production | test
PORT=8000                     # Server port
USER_BASE_DIR=/home/app/users # User directories
SESSION_BASE_DIR=/home/app/ws # Session directories

# Anthropic API
ANTHROPIC_BASE_URL=https://your-workspace.databricks.com/serving-endpoints/anthropic
ANTHROPIC_DEFAULT_OPUS_MODEL=databricks-claude-opus-4-5
ANTHROPIC_DEFAULT_SONNET_MODEL=databricks-claude-sonnet-4-5
ANTHROPIC_DEFAULT_HAIKU_MODEL=databricks-claude-haiku-4-5
```

### Accessing Config

```typescript
fastify.get('/example', async (request, reply) => {
  const port = fastify.config.PORT;
  const nodeEnv = fastify.config.NODE_ENV;
  const databaseUrl = fastify.config.DATABASE_URL;
  // ...
});
```

## Static File Serving

Serves React frontend directly from Fastify:

- `/api/*` -> API endpoints
- Other paths -> Static files from `frontend/dist`
- SPA fallback -> `index.html`

### Caching Strategy

| File Type | Cache |
|-----------|-------|
| JS/CSS/Fonts | 1 year (immutable) |
| HTML/Images | 1 hour (must-revalidate) |
| API | No cache |

## Testing

### Running Tests

```bash
npm run test           # Run tests
npm run test:watch     # Watch mode
npm run test:ui        # Vitest UI
npm run test:coverage  # Coverage
```

### Test Pattern

```typescript
// routes/health.test.ts
import { build } from '../app.js';
import { describe, it, expect, afterAll } from 'vitest';

describe('Health Route', () => {
  const app = await build();

  afterAll(() => app.close());

  it('returns health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
    });
  });
});
```

## Error Handling

### Standard Error Response

```typescript
import type { ApiError } from '@repo/types';

fastify.setErrorHandler((error, request, reply) => {
  const statusCode = error.statusCode || 500;
  const errorResponse: ApiError = {
    error: error.name || 'InternalServerError',
    message: error.message || 'An unexpected error occurred',
    statusCode,
  };
  reply.status(statusCode).send(errorResponse);
});
```

### Route Level

```typescript
fastify.get('/users/:id', async (request, reply) => {
  const user = await fetchUser(request.params.id);

  if (!user) {
    return reply.status(404).send({
      error: 'NotFound',
      message: 'User not found',
      statusCode: 404,
    });
  }

  return reply.send(user);
});
```

## Development

```bash
npm run dev      # Dev server (tsx watch)
npm run build    # TypeScript build
npm run start    # Production server
```

## Troubleshooting

### Port Already in Use

```bash
lsof -i :8000    # Find process
kill -9 <PID>    # Kill process
```

### Type Errors

1. Build `@repo/types`: `npm run build --filter=@repo/types`
2. Use `.js` extension in import paths (ESM requirement)

### Database Connection Errors

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` is correct
3. Sync schema with `npm run db:push`
