CREATE INDEX "sessions_updated_at_idx" ON "sessions" ("updated_at");--> statement-breakpoint
CREATE INDEX "sessions_active_idx" ON "sessions" ("user_id","updated_at") WHERE is_archived = false;