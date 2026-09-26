CREATE TABLE "repaso_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"deck_id" uuid NOT NULL,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"state" text DEFAULT 'new' NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"due_at" bigint DEFAULT 0 NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"ease" integer DEFAULT 2500 NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "repaso_cards_state" CHECK ("repaso_cards"."state" in ('new', 'learning', 'review', 'relearning'))
);
--> statement-breakpoint
ALTER TABLE "repaso_cards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "repaso_decks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "repaso_decks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "repaso_cards" ADD CONSTRAINT "repaso_cards_deck_id_repaso_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "public"."repaso_decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repaso_cards_user" ON "repaso_cards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "repaso_cards_deck" ON "repaso_cards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "repaso_decks_user" ON "repaso_decks" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "repaso_cards_own" ON "repaso_cards" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());--> statement-breakpoint
CREATE POLICY "repaso_decks_own" ON "repaso_decks" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());