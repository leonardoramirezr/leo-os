CREATE TABLE "dictado_texts" (
	"user_id" text PRIMARY KEY DEFAULT auth.user_id() NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dictado_texts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "dictado_texts_own" ON "dictado_texts" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());