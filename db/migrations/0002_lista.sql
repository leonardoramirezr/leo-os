CREATE TABLE "lista_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"text" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lista_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "lista_items_user" ON "lista_items" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "lista_items_own" ON "lista_items" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());