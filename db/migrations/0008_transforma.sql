CREATE TABLE "transforma_prompts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"auto_title" text DEFAULT '' NOT NULL,
	"instructions" text NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transforma_prompts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transforma_texts" (
	"user_id" text PRIMARY KEY DEFAULT auth.user_id() NOT NULL,
	"versions" jsonb NOT NULL,
	"current" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transforma_texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "transforma_prompts_user" ON "transforma_prompts" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "transforma_prompts_own" ON "transforma_prompts" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());--> statement-breakpoint
CREATE POLICY "transforma_texts_own" ON "transforma_texts" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());