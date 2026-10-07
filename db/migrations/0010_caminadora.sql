CREATE TABLE "caminadora_programs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"name" text NOT NULL,
	"segments" jsonb NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "caminadora_programs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "caminadora_programs_user" ON "caminadora_programs" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "caminadora_programs_own" ON "caminadora_programs" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());