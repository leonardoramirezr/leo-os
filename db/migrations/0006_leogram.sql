CREATE TABLE "leogram_avatars" (
	"user_id" text PRIMARY KEY DEFAULT auth.user_id() NOT NULL,
	"key" text NOT NULL,
	"size" bigint NOT NULL,
	CONSTRAINT "leogram_avatars_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "leogram_avatars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leogram_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"text" text NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "leogram_comments_text" CHECK (char_length("leogram_comments"."text") between 1 and 2200)
);
--> statement-breakpoint
ALTER TABLE "leogram_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leogram_likes" (
	"post_id" text NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	CONSTRAINT "leogram_likes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "leogram_likes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leogram_media" (
	"post_id" text NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"slot" integer NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"size" bigint NOT NULL,
	"focus_x" smallint DEFAULT 50 NOT NULL,
	"focus_y" smallint DEFAULT 50 NOT NULL,
	CONSTRAINT "leogram_media_post_id_slot_kind_pk" PRIMARY KEY("post_id","slot","kind"),
	CONSTRAINT "leogram_media_key_unique" UNIQUE("key"),
	CONSTRAINT "leogram_media_slot" CHECK ("leogram_media"."slot" between -1 and 9),
	CONSTRAINT "leogram_media_kind" CHECK ("leogram_media"."kind" in ('photo', 'video', 'poster', 'thumb', 'song')),
	CONSTRAINT "leogram_media_song" CHECK (("leogram_media"."kind" = 'song') = ("leogram_media"."slot" = -1)),
	CONSTRAINT "leogram_media_focus_x" CHECK ("leogram_media"."focus_x" between 0 and 100),
	CONSTRAINT "leogram_media_focus_y" CHECK ("leogram_media"."focus_y" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "leogram_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leogram_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT auth.user_id() NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"aspect" text NOT NULL,
	"slides" integer NOT NULL,
	"music" jsonb,
	"created_at" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "leogram_posts_id" CHECK ("leogram_posts"."id" ~ '^[A-Za-z0-9_-]{11}$'),
	CONSTRAINT "leogram_posts_aspect" CHECK ("leogram_posts"."aspect" in ('square', 'portrait', 'landscape')),
	CONSTRAINT "leogram_posts_slides" CHECK ("leogram_posts"."slides" between 1 and 10),
	CONSTRAINT "leogram_posts_caption" CHECK (char_length("leogram_posts"."caption") <= 2200)
);
--> statement-breakpoint
ALTER TABLE "leogram_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "leogram_profiles" (
	"user_id" text PRIMARY KEY DEFAULT auth.user_id() NOT NULL,
	"username" text NOT NULL,
	CONSTRAINT "leogram_profiles_username" CHECK ("leogram_profiles"."username" ~ '^[a-z0-9._]{1,30}$')
);
--> statement-breakpoint
ALTER TABLE "leogram_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leogram_avatars" ADD CONSTRAINT "leogram_avatars_user_id_leogram_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."leogram_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leogram_comments" ADD CONSTRAINT "leogram_comments_post_id_leogram_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."leogram_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leogram_comments" ADD CONSTRAINT "leogram_comments_user_id_leogram_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."leogram_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leogram_likes" ADD CONSTRAINT "leogram_likes_post_id_leogram_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."leogram_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leogram_media" ADD CONSTRAINT "leogram_media_post_id_leogram_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."leogram_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leogram_posts" ADD CONSTRAINT "leogram_posts_user_id_leogram_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."leogram_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leogram_comments_post" ON "leogram_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "leogram_comments_user" ON "leogram_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leogram_likes_user" ON "leogram_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leogram_media_user" ON "leogram_media" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "leogram_posts_user" ON "leogram_posts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leogram_profiles_username_unique" ON "leogram_profiles" USING btree ("username");--> statement-breakpoint
CREATE POLICY "leogram_comments_own" ON "leogram_comments" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());--> statement-breakpoint
CREATE POLICY "leogram_comments_post_author_select" ON "leogram_comments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (exists (select from leogram_posts p where p.id = "leogram_comments"."post_id" and p.user_id = auth.user_id()));--> statement-breakpoint
CREATE POLICY "leogram_comments_post_author_delete" ON "leogram_comments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (exists (select from leogram_posts p where p.id = "leogram_comments"."post_id" and p.user_id = auth.user_id()));--> statement-breakpoint
CREATE POLICY "leogram_likes_own" ON "leogram_likes" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());--> statement-breakpoint
CREATE POLICY "leogram_posts_own" ON "leogram_posts" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());--> statement-breakpoint
CREATE POLICY "leogram_profiles_own" ON "leogram_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());