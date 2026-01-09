-- Custom SQL migration file, put your code below! --

-- Add status column
ALTER TABLE "sessions" ADD COLUMN "status" text NOT NULL DEFAULT 'idle';

-- Add context JSONB column
ALTER TABLE "sessions" ADD COLUMN "context" jsonb;

-- Migrate existing data: is_archived -> status
UPDATE "sessions" SET "status" = 'archived' WHERE "is_archived" = true;

-- Migrate existing data: databricks_workspace_path/auto_push -> context
UPDATE "sessions" SET "context" = jsonb_build_object(
  'allowed_tools', '[]'::jsonb,
  'disallowed_tools', '[]'::jsonb,
  'cwd', '',
  'model', 'sonnet',
  'sources', COALESCE(
    CASE WHEN "databricks_workspace_path" IS NOT NULL
    THEN jsonb_build_array(jsonb_build_object('type', 'databricks_workspace', 'path', "databricks_workspace_path"))
    ELSE '[]'::jsonb END, '[]'::jsonb),
  'outcomes', COALESCE(
    CASE WHEN "databricks_workspace_path" IS NOT NULL AND "databricks_workspace_auto_push" = true
    THEN jsonb_build_array(jsonb_build_object('type', 'databricks_workspace', 'path', "databricks_workspace_path"))
    ELSE '[]'::jsonb END, '[]'::jsonb)
)
WHERE "context" IS NULL;

-- Drop old columns
ALTER TABLE "sessions" DROP COLUMN "is_archived";
ALTER TABLE "sessions" DROP COLUMN "databricks_workspace_path";
ALTER TABLE "sessions" DROP COLUMN "databricks_workspace_auto_push";

-- Drop old index
DROP INDEX IF EXISTS "sessions_active_idx";

-- Create new indexes
CREATE INDEX "sessions_status_idx" ON "sessions" ("status");
CREATE INDEX "sessions_active_idx" ON "sessions" ("user_id", "updated_at") WHERE status != 'archived';
