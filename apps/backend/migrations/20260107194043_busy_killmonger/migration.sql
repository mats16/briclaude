CREATE TABLE "oauth_tokens" (
	"user_id" text,
	"auth_type" text,
	"provider" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY("user_id","auth_type","provider")
);
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_events" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"subtype" text,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text,
	"title" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY,
	"claude_config_backup" text DEFAULT 'auto' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "oauth_tokens_user_id_idx" ON "oauth_tokens" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_events_session_id_seq_unique" ON "session_events" ("session_id","seq");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "oauth_tokens_user_isolation_policy" ON "oauth_tokens" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "sessions_user_isolation_policy" ON "sessions" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));--> statement-breakpoint
CREATE POLICY "user_settings_user_isolation_policy" ON "user_settings" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.user_id', true)) WITH CHECK (user_id = current_setting('app.user_id', true));