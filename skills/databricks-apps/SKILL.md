---
name: databricks-apps
description: Databricks Apps deployment, debugging, and configuration management. Use when working with Databricks Apps issues including deployment failures, app configuration (app.yaml), checking logs, granting permissions to SQL warehouses or Unity Catalog resources, troubleshooting app errors, or managing app state (start/stop). Triggered by mentions of SESSION_APP_NAME, app.yaml, deployment errors, or permission issues with Apps.
---

# Databricks Apps

## Tools

**Primary**: `mcp__apps__*` で操作（get, update, start, stop, logs, deploy, list）
**SQL 実行**: `mcp__databricks__run_sql` でユーザー権限で SQL 実行
**Fallback**: CLI (`databricks apps ...`) は MCP で対応できない場合のみ

## Environment

- App name: `$SESSION_APP_NAME`
- Auto deploy: `APP_AUTO_DEPLOY=true` でセッション終了時に自動デプロイ

## Core Workflow

1. **状態確認**: `mcp__apps__get` → `compute_status.state`, `user_api_scopes`, `resources` を確認
2. **ログ確認**: `mcp__apps__logs` → エラー時はまずログを確認
3. **設定変更後**: `mcp__apps__stop` → `mcp__apps__start` で再起動

## Authorization (OBO)

**app.yaml では設定不可。** `mcp__apps__update` で `user_api_scopes` を設定。

### Unity Catalog テーブルアクセスに必要な 4 scopes

| scope | Purpose |
|-------|---------|
| `sql` | SQL Warehouse |
| `catalog.schemas:read` | Schema metadata |
| `catalog.tables:read` | Table metadata |
| `unity-catalog` | Data access |

### All Scopes

`sql`, `catalog.schemas:read`, `catalog.tables:read`, `unity-catalog`, `serving`, `vector-search`, `genie`, `jobs`, `secrets`

### Resource 環境変数

`DATABRICKS_RESOURCE_SQL_WAREHOUSE_ID` などが必要な場合、`resources` も設定:

```json
{
  "name": "sql_warehouse",
  "sql_warehouse": { "id": "WAREHOUSE_ID", "permission": "CAN_USE" }
}
```

## OBO Token による SQL 実行

### セッションからの SQL 実行

`mcp__databricks__run_sql` を使用。ユーザーの OBO token で実行される。

### Apps 内コードでの SQL 実行

```python
from databricks import sql
import os

connection = sql.connect(
    server_hostname=os.environ["DATABRICKS_HOST"],
    http_path=f"/sql/1.0/warehouses/{os.environ['DATABRICKS_RESOURCE_SQL_WAREHOUSE_ID']}",
    access_token=os.environ["DATABRICKS_API_TOKEN"]
)
```

**自動注入される環境変数**:
- `DATABRICKS_HOST`: Workspace URL
- `DATABRICKS_API_TOKEN`: OBO token（`user_api_scopes` 設定時のみ）
- `APP_PORT`: アプリがバインドすべきポート

## Troubleshooting Quick Reference

| Issue | Action |
|-------|--------|
| Deployment failed | `mcp__apps__logs` で deployment_id 指定してログ確認 |
| Permission error | `mcp__apps__get` で `user_api_scopes` 確認 |
| Table access denied | 4 scopes 全て設定されているか確認 |
| App not accessible | `compute_status.state` が ACTIVE か確認 |
| OBO token が null | `user_api_scopes` が空でないか確認 |
| SQL 権限エラー | ユーザー自身がテーブル権限を持っているか確認 |

詳細: [troubleshooting.md](references/troubleshooting.md)

## Service Principal

バックグラウンドジョブなど、ユーザーコンテキストがない場合のみ使用。
詳細: [cli-reference.md](references/cli-reference.md#service-principal-resource-configuration)
