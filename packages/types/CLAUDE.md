# Types Package - Development Guide

## Overview

Shared TypeScript type definitions for API request/response types used by both frontend and backend.

## Naming Conventions

### API Types (Request/Response)

**All API type properties MUST use `snake_case`.**

This ensures consistency with:
- JSON API responses
- Database column naming conventions
- Common REST API conventions

```typescript
// Good - snake_case for API types
export interface TokenInfo {
  provider: string;
  auth_type: string;
  masked_token: string;
  created_at: string;
  updated_at: string;
}

// Bad - camelCase for API types
export interface TokenInfo {
  provider: string;
  authType: string;      // Wrong!
  maskedToken: string;   // Wrong!
  createdAt: string;     // Wrong!
  updatedAt: string;     // Wrong!
}
```

### Exceptions

- Internal TypeScript interfaces not used in API communication may use camelCase
- React component props should use camelCase (frontend convention)

## File Structure

```
packages/types/src/
├── api.ts      # Common API types (ApiError, HealthCheckResponse)
├── session.ts  # Session-related types
├── token.ts    # Token-related types
├── user.ts     # User-related types
└── index.ts    # Re-exports all types
```

## Adding New Types

1. Create or update the appropriate file in `src/`
2. Export the type from `src/index.ts`
3. Use `snake_case` for all API property names
4. Run `npm run build` to compile types
