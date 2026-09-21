CREATE TABLE "me_deben_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" bigint NOT NULL,
	"date" date NOT NULL,
	"due_date" date,
	"plan" text DEFAULT '' NOT NULL,
	"plan_amount" bigint DEFAULT 0 NOT NULL,
	"plan_start" date,
	"from_bank" text DEFAULT '' NOT NULL,
	"to_bank" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "me_deben_movements_kind" CHECK ("me_deben_movements"."kind" in ('loan', 'payment')),
	CONSTRAINT "me_deben_movements_amount" CHECK ("me_deben_movements"."amount" > 0),
	CONSTRAINT "me_deben_movements_plan" CHECK ("me_deben_movements"."plan" in ('', 'weekly', 'monthly'))
);
--> statement-breakpoint
ALTER TABLE "me_deben_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "me_deben_people" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "me_deben_people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "settings" (
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	CONSTRAINT "settings_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "me_deben_movements" ADD CONSTRAINT "me_deben_movements_person_id_me_deben_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."me_deben_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "me_deben_movements_user" ON "me_deben_movements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "me_deben_movements_person" ON "me_deben_movements" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "me_deben_people_user" ON "me_deben_people" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "me_deben_movements_own" ON "me_deben_movements" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());--> statement-breakpoint
CREATE POLICY "me_deben_people_own" ON "me_deben_people" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());--> statement-breakpoint
CREATE POLICY "settings_own" ON "settings" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());