# Frontend Application - Development Guide

## Overview

React 19 single-page application built with Vite 7, TypeScript, and shadcn/ui components.

## Tech Stack

- **Framework**: React 19.0.0
- **Build Tool**: Vite 7.2.0
- **Styling**: Tailwind CSS 3.4.1
- **UI Components**: shadcn/ui (default theme, slate base color)
- **Icons**: lucide-react 0.562.0
- **Type Safety**: TypeScript 5.8+ (strict mode)

## Directory Structure

```
apps/frontend/
├── src/
│   ├── components/
│   │   └── ui/           # shadcn/ui components
│   ├── lib/
│   │   └── utils.ts      # Utility functions (cn, etc.)
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   ├── index.css         # Global styles + Tailwind
│   └── vite-env.d.ts     # Vite type definitions
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── tailwind.config.ts    # Tailwind configuration
├── components.json       # shadcn/ui configuration
└── package.json
```

## React 19 Specific Guidelines

### Component Patterns

**Prefer functional components with hooks:**

```typescript
// ✅ Good
import { useState, useEffect } from 'react';

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  return <div>{user?.name}</div>;
}

// ❌ Bad - Don't use class components or PropTypes
```

### State Management

- Use `useState` for local state
- Use `useEffect` for side effects
- For shared state, consider Context API or state management library (future)

### Type Safety

Always type component props and state:

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

// ❌ Bad - Don't use any or skip typing
function Button({ label, onClick }: any) { /* ... */ }
```

## Styling with Tailwind CSS

### Class Organization

Order classes by category:

1. Layout (flex, grid, block)
2. Spacing (p-_, m-_, space-\*)
3. Sizing (w-_, h-_)
4. Typography (text-_, font-_)
5. Colors (bg-_, text-_)
6. Effects (shadow-_, rounded-_)

```typescript
// ✅ Good
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow-sm">

// ❌ Bad - Random order
<div className="shadow-sm p-4 flex rounded-lg items-center bg-white gap-4">
```

### Using cn() Utility

Always use `cn()` for conditional classes:

```typescript
import { cn } from '@/lib/utils';

// ✅ Good
<button className={cn(
  "px-4 py-2 rounded-md",
  variant === 'primary' && "bg-primary text-white",
  variant === 'secondary' && "bg-secondary",
  disabled && "opacity-50 cursor-not-allowed"
)}>

// ❌ Bad - String concatenation
<button className={`px-4 py-2 ${variant === 'primary' ? 'bg-primary' : ''}`}>
```

### CSS Variables

Theme colors are defined using CSS variables in `src/index.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  /* ... */
}
```

Use Tailwind classes that reference these variables:

```typescript
<div className="bg-background text-foreground">
<button className="bg-primary text-primary-foreground">
```

## shadcn/ui Components

### Installing Components

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add dialog
```

### Usage Pattern

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function Example() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default">Click me</Button>
      </CardContent>
    </Card>
  );
}
```

### Customization

- Components are fully customizable - edit files in `src/components/ui/`
- Variants are defined using `class-variance-authority`
- Base styles use Tailwind utility classes

### Available Variants

Check each component for available variants:

```typescript
// Button variants
<Button variant="default" size="default">
<Button variant="destructive" size="sm">
<Button variant="outline" size="lg">
<Button variant="ghost" size="icon">
```

## API Integration

### Fetching Data

Always type API responses:

```typescript
import type { HealthCheckResponse } from '@repo/types';

// ✅ Good - With types
async function checkHealth() {
  const response = await fetch('/api/health');
  const data: HealthCheckResponse = await response.json();
  return data;
}

// ❌ Bad - No types
async function checkHealth() {
  const response = await fetch('/api/health');
  return response.json();
}
```

### Error Handling

```typescript
// ✅ Good - Comprehensive error handling
try {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data: HealthCheckResponse = await response.json();
  return data;
} catch (error) {
  console.error('Failed to fetch health:', error);
  // Handle error appropriately
}
```

### API Proxy

In development, `/api/*` requests are proxied to `http://localhost:3001`:

```typescript
// Development
fetch('/api/health'); // → http://localhost:3001/api/health

// Production (use environment variable)
const API_URL = import.meta.env.VITE_API_URL || '';
fetch(`${API_URL}/api/health`);
```

## Path Aliases

The `@/` alias maps to `src/`:

```typescript
// ✅ Good - Use aliases
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ❌ Bad - Relative paths for common imports
import { Button } from '../../components/ui/button';
```

## Environment Variables

Vite exposes environment variables with the `VITE_` prefix:

```typescript
// .env
VITE_API_URL=https://api.example.com

// Usage
const apiUrl = import.meta.env.VITE_API_URL;

// Type definition (add to vite-env.d.ts if needed)
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}
```

## Performance Best Practices

### Code Splitting

```typescript
// Lazy load components
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HeavyComponent />
    </Suspense>
  );
}
```

### Memoization

```typescript
import { useMemo, useCallback } from 'react';

// Expensive computations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

// Callback functions
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

## Accessibility

### ARIA Labels

```typescript
// ✅ Good
<button aria-label="Close dialog" onClick={onClose}>
  <X className="h-4 w-4" />
</button>

// ❌ Bad - Icon button without label
<button onClick={onClose}>
  <X className="h-4 w-4" />
</button>
```

### Keyboard Navigation

Ensure interactive elements are keyboard accessible:

```typescript
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
```

## Common Patterns

### Form Handling

```typescript
import { useState, FormEvent } from 'react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Handle login
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

### Loading States

```typescript
function DataComponent() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchData()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No data</div>;

  return <div>{/* Render data */}</div>;
}
```

## Testing (Future)

When adding tests:

```typescript
// Component.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

## Build & Deployment

### Build for Production

```bash
npm run build
```

Output: `dist/` directory

### Preview Production Build

```bash
npm run preview
```

### Environment-Specific Builds

```bash
# Development
VITE_API_URL=http://localhost:3001 npm run build

# Production
VITE_API_URL=https://api.production.com npm run build
```

## Troubleshooting

### Hot Module Replacement (HMR) Issues

1. Check that Vite dev server is running on port 3000
2. Ensure no syntax errors in files
3. Restart dev server: `npm run dev`

### Tailwind Classes Not Working

1. Check `tailwind.config.ts` content paths include your files
2. Ensure `index.css` imports Tailwind directives
3. Restart dev server

### shadcn/ui Components Not Found

1. Verify component was installed: `npx shadcn-ui@latest add <component>`
2. Check import path uses `@/components/ui/`
3. Ensure `components.json` aliases are correct

### Type Errors

1. Ensure `@repo/types` is built: `npm run build --filter=@repo/types`
2. Restart TypeScript server in editor
3. Check `tsconfig.json` references

## Code Review Checklist

- [ ] All components are properly typed
- [ ] No `any` types used
- [ ] Tailwind classes are organized consistently
- [ ] `cn()` utility is used for conditional classes
- [ ] API responses are typed with `@repo/types`
- [ ] Error handling is implemented
- [ ] Accessibility attributes are present
- [ ] Code is formatted with Prettier
- [ ] No ESLint errors
