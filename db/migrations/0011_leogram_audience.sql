CREATE TABLE "leogram_audience" (
	"post_id" text NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"friend_id" text NOT NULL,
	CONSTRAINT "leogram_audience_post_id_friend_id_pk" PRIMARY KEY("post_id","friend_id"),
	CONSTRAINT "leogram_audience_not_author" CHECK ("leogram_audience"."friend_id" <> "leogram_audience"."user_id")
);
--> statement-breakpoint
ALTER TABLE "leogram_audience" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leogram_favorites" (
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"friend_id" text NOT NULL,
	CONSTRAINT "leogram_favorites_user_id_friend_id_pk" PRIMARY KEY("user_id","friend_id"),
	CONSTRAINT "leogram_favorites_not_self" CHECK ("leogram_favorites"."friend_id" <> "leogram_favorites"."user_id")
);
--> statement-breakpoint
ALTER TABLE "leogram_favorites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leogram_posts" ADD COLUMN "audience" text DEFAULT 'link' NOT NULL;--> statement-breakpoint
ALTER TABLE "leogram_posts" ADD COLUMN "listed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leogram_audience" ADD CONSTRAINT "leogram_audience_post_id_leogram_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."leogram_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leogram_audience" ADD CONSTRAINT "leogram_audience_friend_id_leogram_profiles_user_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."leogram_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leogram_favorites" ADD CONSTRAINT "leogram_favorites_friend_id_leogram_profiles_user_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."leogram_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leogram_audience_friend" ON "leogram_audience" USING btree ("friend_id");--> statement-breakpoint
CREATE INDEX "leogram_favorites_friend" ON "leogram_favorites" USING btree ("friend_id");--> statement-breakpoint
ALTER TABLE "leogram_posts" ADD CONSTRAINT "leogram_posts_audience" CHECK ("leogram_posts"."audience" in ('link', 'friends'));--> statement-breakpoint
CREATE POLICY "leogram_favorites_own" ON "leogram_favorites" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());