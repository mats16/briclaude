# Deployment Guide

This guide explains how to deploy BriClaude to Databricks Apps.

## Prerequisites

- Databricks CLI installed and configured
- Access to a Databricks workspace with Apps enabled
- PostgreSQL-compatible database (Lakebase recommended)

## 1. Database Setup

### 1.1 Create Database

Create a PostgreSQL-compatible database in Lakebase or an external PostgreSQL instance.

**Using Databricks Lakebase (recommended):**

```sql
-- Create database
CREATE DATABASE briclaude;
```

**Using external PostgreSQL:**

Ensure the database is accessible from Databricks Apps via network configuration.

### 1.2 Create Application User

Create a dedicated database user for the application and grant database owner privileges.

```sql
-- Create application user with RLS bypass explicitly disabled
CREATE USER briclaude_user WITH PASSWORD 'your-secure-password' NOBYPASSRLS;

-- Grant database owner privileges
ALTER DATABASE briclaude OWNER TO briclaude_user;
```

**Important:** The application uses Row-Level Security (RLS) with `current_setting('app.user_id', true)`. The application sets this session variable for each request to enforce user isolation. The `NOBYPASSRLS` option ensures the application user cannot bypass RLS policies, providing an additional layer of security.

### 1.3 Database Migrations

Database migrations are automatically applied when the server starts. No manual migration steps are required for deployment.

**For local development or manual migration:**

```bash
# Set database URL
export DATABASE_URL="postgresql://admin:password@host:5432/briclaude"

# Navigate to api directory
cd apps/api

# Generate migration files (if schema changed)
npm run db:generate

# Manually apply migrations (optional)
npm run db:migrate
```

## 2. Configure Secrets

Create a Databricks secret scope and add required secrets.

### 2.1 Create Secret Scope

```bash
# For development environment
databricks secrets create-scope briclaude-dev

# For production environment
databricks secrets create-scope briclaude-prod
```

### 2.2 Add Required Secrets

**Database URL:**

```bash
# Development
databricks secrets put-secret briclaude-dev database-url --string-value "postgresql://briclaude_user:password@host:5432/briclaude"

# Production
databricks secrets put-secret briclaude-prod database-url --string-value "postgresql://briclaude_user:password@host:5432/briclaude"
```

**Encryption Key:**

Generate a secure encryption key for encrypting sensitive data (OAuth tokens, etc.). A 32-byte key (64 hexadecimal characters) is required.

```bash
# Generate encryption key
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Development
databricks secrets put-secret briclaude-dev encryption-key --string-value "$ENCRYPTION_KEY"

# Production
databricks secrets put-secret briclaude-prod encryption-key --string-value "$ENCRYPTION_KEY"
```

## 3. Deploy with Asset Bundles

> **Note:** This deployment method using Databricks Asset Bundles is a temporary solution until Lakebase support is available in the bundle configuration. Once Lakebase integration is supported, the database and user creation steps may be automated through bundle resources.

### 3.1 Validate Bundle Configuration

```bash
databricks bundle validate --target [dev|prod]
```

### 3.2 Deploy to Databricks

```bash
databricks bundle deploy --target [dev|prod]
```

### 3.3 Verify Deployment

After deployment, check the application status:

```bash
# List deployed apps
databricks apps list

# Get app details
databricks apps get briclaude-dev-<user-id>
```

## 4. Post-Deployment Verification

### 4.1 Check Application Health

Access the health endpoint to verify the application is running:

```bash
curl https://<workspace-url>/apps/<app-name>/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2026-01-20T00:00:00.000Z",
  "service": "briclaude-api"
}
```

### 4.2 Check Database Connection

The health endpoint also verifies database connectivity. If there are database issues, the status will indicate an error.

## Troubleshooting

### Database Connection Issues

1. Verify the database URL in secrets is correct
2. Check network connectivity between Databricks Apps and the database
3. Ensure the database user has appropriate permissions

### Migration Failures

1. Ensure the database user has owner privileges
2. Check for existing objects that might conflict
3. Review the migration SQL files for errors

### Application Startup Issues

1. Check application logs in Databricks Apps console
2. Verify all required secrets are configured
3. Ensure the build completed successfully before deployment

## Environment-Specific Configuration

| Setting | Development | Production |
|---------|-------------|------------|
| Bundle Target | `dev` | `prod` |
| Secret Scope | `briclaude-dev` | `briclaude-prod` |
| App Name | `briclaude-dev-<user-id>` | `briclaude-prod` |
| Workspace Path | `/Workspace/Users/<user>/.bundle/...` | `/Workspace/Shared/.bundle/...` |

## Security Considerations

1. **Database credentials:** Always use dedicated application users, not admin accounts
2. **Encryption keys:** Generate unique keys for each environment
3. **Secret scopes:** Restrict access to secret scopes appropriately
4. **Network security:** Configure private endpoints where possible
