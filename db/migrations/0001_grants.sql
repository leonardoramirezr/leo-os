-- Written by hand: drizzle-kit tracks tables, columns and policies, not grants.
--
-- The Data API runs every request as `authenticated` (with a token) or `anonymous` (without one).
-- A policy decides which rows a request may touch; a grant decides whether it may reach the table
-- at all, and neither role is granted anything to begin with.
--
-- The default privileges cover every table a later migration creates, so a new model needs nothing
-- added here. They belong to the role that runs the migrations — the one in `DATABASE_URL` — so
-- keep using the same one.
GRANT USAGE ON SCHEMA public TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
--> statement-breakpoint
-- Signed out there is nothing to see. Said out loud so that granting it stays a deliberate act.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anonymous;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anonymous;
