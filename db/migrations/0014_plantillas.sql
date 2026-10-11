CREATE TABLE "plantillas_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plantillas_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "plantillas_templates_user" ON "plantillas_templates" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "plantillas_templates_own" ON "plantillas_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());