CREATE TABLE "plantillas_answers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"edited_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plantillas_answers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "plantillas_answers" ADD CONSTRAINT "plantillas_answers_id_plantillas_templates_id_fk" FOREIGN KEY ("id") REFERENCES "public"."plantillas_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plantillas_answers_user" ON "plantillas_answers" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "plantillas_answers_own" ON "plantillas_answers" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());