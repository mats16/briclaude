# Databricks Apps Troubleshooting Guide

## Table of Contents

- [First Steps](#first-steps)
- [Deployment Issues](#deployment-issues)
- [Authorization Issues](#authorization-issues)
- [OBO Token Issues](#obo-token-issues)
- [SQL Execution Issues](#sql-execution-issues)
- [Runtime Issues](#runtime-issues)
- [app.yaml Reference](#appyaml-reference)

## First Steps

1. `mcp__apps__get` で状態確認
2. `mcp__apps__logs` でログ確認
3. `mcp__apps__list_-_deployments` でデプロイ履歴

## Deployment Issues

### Deployment Failed

`mcp__apps__logs` で `deployment_id` を指定してログ確認。

| Cause | Solution |
|-------|----------|
| Invalid app.yaml | syntax と required fields を確認 |
| Missing dependencies | requirements.txt を確認 |
| Code errors | Python syntax, imports を確認 |
| Resource limits | memory/CPU 使用量を削減 |

## Authorization Issues

### Permission Errors

`mcp__apps__get` で `user_api_scopes` と `resources` を確認。

### Table Access Denied

**4 scopes 全て必要:**
- `sql`
- `catalog.schemas:read`
- `catalog.tables:read`
- `unity-catalog`

`mcp__apps__update` で設定後、`mcp__apps__stop` → `mcp__apps__start` で再起動。

### Other Access Denied

| Resource | Required Scope |
|----------|---------------|
| SQL Warehouse | `sql` |
| Serving Endpoint | `serving` |
| Vector Search | `vector-search` |
| Genie Space | `genie` |
| Secrets | `secrets` |

### Common Mistakes

| Problem | Solution |
|---------|----------|
| `user_api_scopes` 未設定 | `mcp__apps__update` で追加 |
| catalog scopes 不足 | `catalog.schemas:read`, `catalog.tables:read` を追加 |
| app.yaml に設定 | 非対応。`mcp__apps__update` を使用 |
| User に権限なし | ユーザーに直接 GRANT |
| 環境変数が取得できない | `resources` を設定 |

## OBO Token Issues

### DATABRICKS_API_TOKEN が null

**原因**: `user_api_scopes` が未設定

**解決**: `mcp__apps__update` で scopes を設定し、再起動。

### Token 有効期限切れ

- Apps runtime が自動更新する
- コネクションを長時間保持しない
- エラー時はリトライ実装

### ユーザー未ログイン

OBO はユーザーセッションが必要。ユーザーが Apps URL にアクセスしているか確認。

## SQL Execution Issues

### mcp__databricks__run_sql でエラー

| Error | Cause | Solution |
|-------|-------|----------|
| `PERMISSION_DENIED` | User にテーブル権限なし | User に直接 GRANT |
| `TABLE_OR_VIEW_NOT_FOUND` | テーブル名誤り | 完全修飾名を使用 |
| `RESOURCE_DOES_NOT_EXIST` | Warehouse なし | Warehouse ID 確認 |
| `INVALID_SESSION` | Session 無効 | Apps 再起動 |

### 権限確認

`mcp__databricks__run_sql` で `SHOW GRANTS ON TABLE catalog.schema.table` を実行。

### Warehouse 未起動

クエリ実行時に自動起動されるが、初回は時間がかかる場合がある。

## Runtime Issues

### App Not Accessible

`mcp__apps__get` で確認:
- `compute_status.state` = `ACTIVE`
- `active_deployment.status.state` = `SUCCEEDED`

`ACTIVE` でなければ `mcp__apps__start`。

### App Crashes

`mcp__apps__logs` でログ確認。

**Common causes:**
- `APP_PORT` 環境変数にバインドしていない
- 環境変数不足
- Import エラー

### 環境変数が取得できない

**Resource ID 系** (`DATABRICKS_RESOURCE_SQL_WAREHOUSE_ID` など):
`mcp__apps__update` で `resources` を設定。

**自動注入される変数**:
- `DATABRICKS_HOST`
- `DATABRICKS_API_TOKEN` (OBO 有効時)
- `APP_PORT`

### Secrets が取得できない

**app.yaml で設定:**
```yaml
env:
  - name: API_KEY
    valueFrom:
      secretRef:
        key: api_key
        scope: my-scope
```

**または OBO で取得:**
`user_api_scopes` に `secrets` を追加。

## app.yaml Reference

**Note:** `user_api_scopes`, `resources` は app.yaml では設定不可。

```yaml
command:
  - "python"
  - "main.py"

env:
  - name: VAR_NAME
    value: "static_value"
  - name: SECRET_VAR
    valueFrom:
      secretRef:
        key: secret_key
        scope: secret_scope
```

**Important:** `APP_PORT` 環境変数のポート (default: 8000) でリッスンすること。
