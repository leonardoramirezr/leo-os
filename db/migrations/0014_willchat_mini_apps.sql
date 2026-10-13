CREATE TABLE "willchat_mini_apps" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"name" text NOT NULL,
	"prompt" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "willchat_mini_apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "willchat_mini_apps_user" ON "willchat_mini_apps" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "willchat_mini_apps_own" ON "willchat_mini_apps" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());