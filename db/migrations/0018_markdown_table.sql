CREATE TABLE "markdown_tables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"cells" jsonb NOT NULL,
	"align" jsonb NOT NULL,
	"style" text DEFAULT '' NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL,
	"edited_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "markdown_tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "markdown_tables_user" ON "markdown_tables" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "markdown_tables_own" ON "markdown_tables" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());