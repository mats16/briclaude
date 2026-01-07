# Backend Application - Development Guide

## Overview

REST API server built with Fastify 5, TypeScript, and designed for high performance and type safety.

## Tech Stack

- **Framework**: Fastify 5.2.0 (5-10% faster than v4)
- **Language**: TypeScript 5.8+ (strict mode)
- **CORS**: @fastify/cors 10.0.1
- **Runtime**: Node.js 22.16 (LTS)
- **Development**: tsx 4.19.2 (TypeScript execution)

## Directory Structure

```
apps/backend/
├── src/
│   ├── routes/           # Route handlers
│   │   └── health.ts     # Health check endpoint
│   ├── plugins/          # Fastify plugins (future)
│   ├── app.ts            # Fastify app setup
│   └── server.ts         # Server entry point
├── .env.example          # Environment variable template
├── eslint.config.js      # ESLint configuration
├── tsconfig.json         # TypeScript configuration
└── package.json
```

## Fastify 5 Specific Guidelines

### Route Definition Pattern

Always use TypeScript generics for type-safe routes:

```typescript
import { FastifyPluginAsync } from 'fastify';
import type { HealthCheckResponse } from '@repo/types';

const healthRoute: FastifyPluginAsync = async fastify => {
  // ✅ Good - Typed route
  fastify.get<{ Reply: HealthCheckResponse }>('/health', async (request, reply) => {
    const response: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'my-service',
    };
    return reply.send(response);
  });
};

export default healthRoute;
```

### Request/Reply Types

```typescript
interface RouteParams {
  id: string;
}

interface QueryString {
  filter?: string;
}

interface RequestBody {
  name: string;
  email: string;
}

interface ResponseBody {
  id: string;
  name: string;
}

fastify.post<{
  Params: RouteParams;
  Querystring: QueryString;
  Body: RequestBody;
  Reply: ResponseBody;
}>('/users/:id', async (request, reply) => {
  const { id } = request.params;
  const { filter } = request.query;
  const { name, email } = request.body;

  // Implementation
  const response: ResponseBody = { id, name };
  return reply.send(response);
});
```

### Plugin Registration

```typescript
// app.ts
import cors from '@fastify/cors';
import healthRoute from './routes/health.js';

export async function build() {
  const app = Fastify({
    logger: true,
  });

  // Register plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });

  // Register routes with prefix
  await app.register(healthRoute, { prefix: '/api' });

  return app;
}
```

## Type Safety with @repo/types

### Shared Type Definitions

Always define API types in `packages/types/src/api.ts`:

```typescript
// packages/types/src/api.ts
export interface CreateUserRequest {
  name: string;
  email: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
```

### Using Shared Types

```typescript
// apps/backend/src/routes/users.ts
import type { CreateUserRequest, UserResponse } from '@repo/types';

fastify.post<{
  Body: CreateUserRequest;
  Reply: UserResponse;
}>('/users', async (request, reply) => {
  const userData = request.body; // Typed as CreateUserRequest

  // Create user logic
  const user: UserResponse = {
    id: generateId(),
    name: userData.name,
    email: userData.email,
    createdAt: new Date().toISOString(),
  };

  return reply.send(user);
});
```

## Error Handling

### Standard Error Response

```typescript
import type { ApiError } from '@repo/types';

// Custom error handler
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

### Route-Level Error Handling

```typescript
// ✅ Good - Try-catch with proper error response
fastify.get('/users/:id', async (request, reply) => {
  try {
    const user = await fetchUser(request.params.id);

    if (!user) {
      return reply.status(404).send({
        error: 'NotFound',
        message: 'User not found',
        statusCode: 404,
      });
    }

    return reply.send(user);
  } catch (error) {
    request.log.error(error);
    throw error; // Let error handler deal with it
  }
});
```

### Validation Errors

```typescript
// Using Fastify's schema validation
fastify.post(
  '/users',
  {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
        },
      },
    },
  },
  async (request, reply) => {
    // Body is automatically validated
    const { name, email } = request.body;
    // ...
  }
);
```

## Environment Variables

### Configuration Plugin

This project uses `@fastify/env` for type-safe environment variable validation and loading. The config plugin is registered automatically and validates all required environment variables on startup.

### Required Environment Variables

```bash
# Database (required)
DATABASE_URL=postgresql://localhost:5432/mydb

# Encryption (required)
ENCRYPTION_KEY=your-64-character-hex-key-here

# Databricks Host (required)
DATABRICKS_HOST=your-workspace.databricks.com
```

### Optional Environment Variables

```bash
# Server Configuration
NODE_ENV=development  # development | production | test (default: development)
PORT=8000            # Server port (default: 8000)

# Directory Paths
USER_BASE_DIR=/home/app/users      # User directories (default: $HOME/users)
SESSION_BASE_DIR=/home/app/ws      # Working directories (default: $HOME/ws)

# Warehouse Configuration
WAREHOUSE_ID=your-warehouse-id     # SQL Warehouse ID (default: '')

# Databricks Apps Settings
DATABRICKS_APP_NAME=my-app                    # App name (default: '')
DATABRICKS_WORKSPACE_ID=workspace-123         # Workspace ID (default: '')
DATABRICKS_APP_PORT=8000                      # App port (default: 8000)
DATABRICKS_CLIENT_ID=client-id                # Service principal ID (default: '')
DATABRICKS_CLIENT_SECRET=client-secret        # OAuth secret (default: '')

# Anthropic API Configuration
ANTHROPIC_BASE_URL=https://your-workspace.databricks.com/serving-endpoints/anthropic
ANTHROPIC_DEFAULT_OPUS_MODEL=databricks-claude-opus-4-5    # (default)
ANTHROPIC_DEFAULT_SONNET_MODEL=databricks-claude-sonnet-4-5  # (default)
ANTHROPIC_DEFAULT_HAIKU_MODEL=databricks-claude-haiku-4-5    # (default)

# System Configuration
HOME=/home/app                       # Home directory (default: /home/app)
PATH=/usr/local/bin:/usr/bin:/bin   # System PATH
```

### Accessing Configuration

The configuration is available via `fastify.config` after the plugin is registered:

```typescript
// In any route or plugin
fastify.get('/example', async (request, reply) => {
  const databaseUrl = fastify.config.DATABASE_URL;
  const port = fastify.config.PORT;
  const nodeEnv = fastify.config.NODE_ENV;

  return { databaseUrl, port, nodeEnv };
});
```

### Type Safety

The config plugin provides full TypeScript type safety:

```typescript
// TypeScript knows all config properties and their types
fastify.config.PORT; // type: number
fastify.config.NODE_ENV; // type: 'development' | 'production' | 'test'
fastify.config.DATABASE_URL; // type: string
```

### Validation

The plugin validates all environment variables on startup:

- **Required variables** must be present or the application will fail to start
- **Type validation** ensures integers are valid numbers
- **Enum validation** ensures NODE_ENV is one of: `development`, `production`, `test`

If validation fails, you'll see an error like:

```
Failed to load configuration: "DATABASE_URL" is required!
```

### Testing

Environment variables are tested in [src/plugins/config.test.ts](./src/plugins/config.test.ts). The tests verify:

- Required variables validation
- Default values for optional variables
- Type validation (integers, enums)
- Custom configuration values

## Request Context

### Request Decorator Plugin

This project uses a custom `request-decorator` plugin to extract request context from Databricks Apps headers. The plugin makes user information and request metadata easily accessible throughout the application.

### What It Does

The plugin automatically decorates every incoming request with a `ctx` property containing:

- **host**: Original host/domain requested by the client
- **requestId**: UUID for request tracing
- **realIp**: IP address of the client
- **user**: User information from the Identity Provider (IdP)
  - **id**: User identifier
  - **name**: User name
  - **email**: User email
  - **oboAccessToken**: OAuth access token for on-behalf-of authorization

### Accessing Request Context

The context is available via `request.ctx` in any route handler:

```typescript
fastify.get('/example', async (request, reply) => {
  // Access user information
  const userId = request.ctx?.user.id;
  const userName = request.ctx?.user.name;
  const userEmail = request.ctx?.user.email;

  // Access request metadata
  const requestId = request.ctx?.requestId;
  const clientIp = request.ctx?.realIp;
  const host = request.ctx?.host;

  return {
    userId,
    userName,
    requestId,
  };
});
```

### Databricks Apps Headers

The plugin extracts information from these Databricks Apps headers:

| Header                             | Context Property       | Fallback                   |
| ---------------------------------- | ---------------------- | -------------------------- |
| `x-forwarded-host`                 | `ctx.host`                | `req.hostname`             |
| `x-request-id`                     | `ctx.requestId`           | Generated UUID             |
| `x-real-ip`                        | `ctx.realIp`              | `req.ip`                   |
| `x-forwarded-user`                 | `ctx.user.id`             | Empty string               |
| `x-forwarded-preferred-username`   | `ctx.user.name`           | Empty string               |
| `x-forwarded-email`                | `ctx.user.email`          | Empty string               |
| `x-forwarded-access-token`         | `ctx.user.oboAccessToken` | Empty string               |

### Type Safety

The plugin provides full TypeScript type safety through module augmentation:

```typescript
// TypeScript knows the ctx property and its structure
request.ctx?.host; // type: string
request.ctx?.requestId; // type: string
request.ctx?.user.id; // type: string
request.ctx?.user.email; // type: string
```

### Null Safety

The `ctx` property is nullable (`RequestContext | null`), so always use optional chaining:

```typescript
// ✅ Good - Use optional chaining
const userId = request.ctx?.user.id;

// ❌ Bad - May throw if ctx is null
const userId = request.ctx.user.id;
```

### Example: User-Specific Logic

```typescript
fastify.get('/my-data', async (request, reply) => {
  const userId = request.ctx?.user.id;

  if (!userId) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'User ID not found in request context',
    });
  }

  // Fetch user-specific data
  const data = await fetchUserData(userId);

  request.log.info({ userId, requestId: request.ctx?.requestId }, 'Fetched user data');

  return data;
});
```

### Example: Request Tracing

```typescript
fastify.post('/process', async (request, reply) => {
  const requestId = request.ctx?.requestId;

  request.log.info({ requestId }, 'Starting process');

  try {
    const result = await processData(request.body);
    request.log.info({ requestId }, 'Process completed');
    return result;
  } catch (error) {
    request.log.error({ requestId, error }, 'Process failed');
    throw error;
  }
});
```

### Testing

Request context functionality is tested in [src/plugins/request-decorator.test.ts](./src/plugins/request-decorator.test.ts). The tests verify:

- Context extraction from Databricks headers
- Fallback values when headers are missing
- UUID generation for requestId
- User information extraction
- Type safety and null handling
- Multiple concurrent requests

## Logging

### Built-in Logger

Fastify includes Pino logger by default:

```typescript
// Automatic request logging
const app = Fastify({
  logger: true,
});

// Custom logging
fastify.log.info('Server starting');
fastify.log.error(error, 'Failed to fetch user');
fastify.log.debug({ userId: '123' }, 'User data');
```

### Production Logger Config

```typescript
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          headers: request.headers,
        };
      },
    },
  },
});
```

## CORS Configuration

### Development vs Production

```typescript
await app.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### Dynamic Origin

```typescript
await app.register(cors, {
  origin: (origin, callback) => {
    const allowedOrigins = ['http://localhost:3000', 'https://production.example.com'];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
```

## Route Organization

### Structure by Feature

```
src/routes/
├── health.ts       # Health check
├── users.ts        # User routes
├── auth.ts         # Authentication
└── index.ts        # Route registration
```

### Route Registration Pattern

```typescript
// src/routes/index.ts
import { FastifyInstance } from 'fastify';
import healthRoute from './health.js';
import usersRoute from './users.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoute, { prefix: '/api' });
  await app.register(usersRoute, { prefix: '/api/users' });
}

// app.ts
import { registerRoutes } from './routes/index.js';

export async function build() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    /* ... */
  });
  await registerRoutes(app);

  return app;
}
```

## Request Validation

### JSON Schema

```typescript
const createUserSchema = {
  body: {
    type: 'object',
    required: ['name', 'email'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email' },
      age: { type: 'number', minimum: 0, maximum: 150 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
    },
  },
};

fastify.post('/users', { schema: createUserSchema }, async (request, reply) => {
  // Body is validated automatically
  const user = await createUser(request.body);
  return reply.status(201).send(user);
});
```

## Performance Best Practices

### Async/Await

```typescript
// ✅ Good - Use async/await
fastify.get('/users', async (request, reply) => {
  const users = await fetchUsers();
  return reply.send(users);
});

// ❌ Bad - Don't use callbacks
fastify.get('/users', (request, reply) => {
  fetchUsers((err, users) => {
    if (err) reply.send(err);
    reply.send(users);
  });
});
```

### Return vs Reply.send()

```typescript
// ✅ Good - Return directly (Fastify handles it)
fastify.get('/users', async () => {
  const users = await fetchUsers();
  return users;
});

// Also good - Explicit reply for status codes
fastify.post('/users', async (request, reply) => {
  const user = await createUser(request.body);
  return reply.status(201).send(user);
});
```

### Connection Pooling

```typescript
// Database connection pool example
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections
});

// Use in routes
fastify.get('/users', async () => {
  const result = await pool.query('SELECT * FROM users');
  return result.rows;
});
```

## Testing (Future)

### Route Testing

```typescript
// routes/health.test.ts
import { build } from '../app';

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
      service: 'claude-code-on-databricks',
    });
  });
});
```

## Common Patterns

### Authentication Hook (Future)

```typescript
// hooks/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing authentication token',
      statusCode: 401,
    });
  }

  // Verify token
  const user = await verifyToken(token);

  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid token',
      statusCode: 401,
    });
  }

  request.user = user;
}

// Usage
fastify.get('/protected', { preHandler: authenticate }, async request => {
  return { user: request.user };
});
```

### Pagination

```typescript
interface PaginationQuery {
  page?: number;
  limit?: number;
}

fastify.get<{ Querystring: PaginationQuery }>('/users', async request => {
  const page = request.query.page || 1;
  const limit = Math.min(request.query.limit || 10, 100); // Max 100
  const offset = (page - 1) * limit;

  const users = await fetchUsers({ limit, offset });
  const total = await countUsers();

  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
});
```

## Deployment

### Build for Production

```bash
npm run build
```

Output: `dist/` directory

### Run Production Build

```bash
# Set environment variables
export PORT=8000
export NODE_ENV=production
export CORS_ORIGIN=https://frontend.example.com

# Start server
npm start
```

### Process Management (Production)

Use PM2 or similar:

```bash
pm2 start dist/server.js --name backend
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

### CORS Errors

1. Check `.env` file has correct `CORS_ORIGIN`
2. Verify CORS plugin is registered before routes
3. Check browser console for specific error

### Type Errors

1. Ensure `@repo/types` is built: `npm run build --filter=@repo/types`
2. Check import paths use `.js` extension (ESM requirement)
3. Verify `tsconfig.json` extends `@repo/typescript-config/node.json`

### Server Won't Start

1. Check PORT is not in use
2. Verify environment variables are set
3. Check logs for errors: `fastify.log.error()`

## Code Review Checklist

- [ ] All routes are properly typed with generics
- [ ] API types are defined in `@repo/types`
- [ ] Error handling is implemented
- [ ] CORS is configured correctly
- [ ] Environment variables are validated
- [ ] Logging is used appropriately
- [ ] No synchronous blocking operations
- [ ] Code is formatted with Prettier
- [ ] No ESLint errors
- [ ] Import paths use `.js` extension (ESM)
