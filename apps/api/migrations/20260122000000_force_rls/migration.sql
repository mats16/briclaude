-- Force Row Level Security for all RLS-enabled tables
-- This ensures RLS is enforced even for the table owner (application database user)
-- Without FORCE, the table owner bypasses RLS by default in PostgreSQL

-- sessions table
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;

-- user_settings table
ALTER TABLE "user_settings" FORCE ROW LEVEL SECURITY;

-- oauth_tokens table
ALTER TABLE "oauth_tokens" FORCE ROW LEVEL SECURITY;
