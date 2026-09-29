ALTER TABLE "repaso_cards" ADD COLUMN "introduced_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "repaso_decks" ADD COLUMN "new_per_day" integer DEFAULT 0 NOT NULL;