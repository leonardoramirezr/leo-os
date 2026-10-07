CREATE TABLE "rutina_routines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"name" text NOT NULL,
	"days" jsonb NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rutina_routines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rutina_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"routine_id" uuid NOT NULL,
	"day_id" text NOT NULL,
	"started_at" bigint NOT NULL,
	"ended_at" bigint DEFAULT 0 NOT NULL,
	"finished" boolean DEFAULT false NOT NULL,
	"sets" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rutina_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rutina_sessions" ADD CONSTRAINT "rutina_sessions_routine_id_rutina_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."rutina_routines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rutina_routines_user" ON "rutina_routines" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rutina_sessions_user" ON "rutina_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rutina_sessions_routine" ON "rutina_sessions" USING btree ("routine_id");--> statement-breakpoint
CREATE POLICY "rutina_routines_own" ON "rutina_routines" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());--> statement-breakpoint
CREATE POLICY "rutina_sessions_own" ON "rutina_sessions" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());