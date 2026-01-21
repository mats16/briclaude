# Databricks Apps CLI Reference

> **Note:** CLI は `mcp__apps__*` で対応できない場合のフォールバック。

## MCP vs CLI

| Operation | MCP (Primary) | CLI (Fallback) |
|-----------|---------------|----------------|
| Get app | `mcp__apps__get` | `databricks apps get` |
| Update | `mcp__apps__update` | `databricks apps update` |
| Start/Stop | `mcp__apps__start/stop` | `databricks apps start/stop` |
| Logs | `mcp__apps__logs` | `databricks apps logs` |
| Deploy | `mcp__apps__deploy` | `databricks apps deploy` |
| List | `mcp__apps__list` | `databricks apps list` |
| Permissions | - | `databricks apps get-permissions` |

## Resource Types

### SQL Warehouse

```json
{
  "name": "sql_warehouse",
  "sql_warehouse": { "id": "warehouse_id", "permission": "CAN_USE" }
}
```
Env: `DATABRICKS_RESOURCE_SQL_WAREHOUSE_ID`

### Unity Catalog Schema

```json
{
  "name": "catalog_data",
  "unity_catalog_schema": {
    "catalog_name": "catalog_name",
    "schema_name": "schema_name",
    "permission": "SELECT"
  }
}
```
Permissions: `SELECT`, `MODIFY`, `ALL_PRIVILEGES`

### Serving Endpoint

```json
{
  "name": "ml_endpoint",
  "serving_endpoint": { "name": "endpoint_name", "permission": "CAN_QUERY" }
}
```

### Vector Search Index

```json
{
  "name": "vector_index",
  "vector_search_index": { "name": "catalog.schema.index_name", "permission": "CAN_USE" }
}
```

### Genie Space

```json
{
  "name": "genie_space",
  "genie_space": { "id": "genie_space_id", "permission": "CAN_VIEW" }
}
```
Permissions: `CAN_VIEW`, `CAN_EDIT`, `CAN_MANAGE`

### Job

```json
{
  "name": "my_job",
  "job": { "id": "job_id", "permission": "CAN_MANAGE_RUN" }
}
```
Permissions: `CAN_VIEW`, `CAN_MANAGE_RUN`, `CAN_MANAGE`

### Secret Scope

```json
{
  "name": "app_secrets",
  "secret_scope": { "scope": "my_scope", "permission": "READ" }
}
```

## CLI Commands (Fallback)

### App Management

```bash
databricks apps get APP_NAME -o json
databricks apps list -o json
databricks apps update APP_NAME --json '{...}'
databricks apps start APP_NAME
databricks apps stop APP_NAME --no-wait
```

### Deployment

```bash
databricks apps deploy APP_NAME --source-code-path /Workspace/path
databricks apps list-deployments APP_NAME -o json
databricks apps get-deployment APP_NAME DEPLOYMENT_ID -o json
```

### Logs

```bash
databricks apps logs APP_NAME
databricks apps logs APP_NAME --deployment-id DEPLOYMENT_ID
```

### Permissions

```bash
databricks apps get-permissions APP_NAME -o json
databricks apps set-permissions APP_NAME --json '{
  "access_control_list": [
    { "service_principal_name": "SP_NAME", "permission_level": "CAN_MANAGE" }
  ]
}'
```

## Service Principal Resource Configuration

User-on-behalf-of が使えない場合（バックグラウンドジョブなど）のみ使用。

### 1. Resources をバインド

```bash
databricks apps update $SESSION_APP_NAME --json '{
  "resources": [
    { "name": "sql_warehouse", "sql_warehouse": { "id": "WAREHOUSE_ID", "permission": "CAN_USE" } }
  ]
}'
```

### 2. Service Principal Name を取得

```bash
databricks apps get $SESSION_APP_NAME -o json | jq -r '.service_principal_name'
```

### 3. 権限を付与

**SQL Warehouse:**
```bash
databricks warehouses update-permissions WAREHOUSE_ID --json '{
  "access_control_list": [
    { "service_principal_name": "SP_NAME", "permission_level": "CAN_USE" }
  ]
}'
```

**Unity Catalog (SQL):**
```sql
GRANT USE CATALOG ON CATALOG catalog_name TO `service_principal_name`;
GRANT USE SCHEMA ON SCHEMA catalog_name.schema_name TO `service_principal_name`;
GRANT SELECT ON TABLE catalog_name.schema_name.table_name TO `service_principal_name`;
```

## App Object Structure

```json
{
  "name": "app-name",
  "service_principal_id": 123456,
  "service_principal_name": "app-name-sp",
  "user_api_scopes": ["sql", "catalog.schemas:read", "catalog.tables:read", "unity-catalog"],
  "resources": [...],
  "compute_status": { "state": "ACTIVE|STOPPED|ERROR" },
  "active_deployment": {
    "deployment_id": "...",
    "status": { "state": "SUCCEEDED|FAILED|IN_PROGRESS" }
  },
  "url": "https://app-name.cloud.databricks.com"
}
```
