// The models: what the database holds, and the only place it is described. `pnpm db:generate`
// reads this file, compares it with the last migration, and writes the SQL for the difference into
// `migrations/`; `pnpm db:migrate` applies what is pending. Nothing is ever edited straight into
// the database — a change starts here.
//
// Every table is reached straight from the browser through the Data API, so row level security is
// the whole of the protection: each row carries the account it belongs to and every policy checks
// it against `auth.user_id()`, the `sub` of the Neon Auth session behind the request. Signed out,
// the token is the anonymous one Neon Auth hands anybody, which the Data API runs as the
// `anonymous` role: it reaches no table at all, and may only call the functions that show a
// Leogram post to whoever has its link and is meant to see it, and an account's bio
// (`migrations/0007_leogram_public.sql`, `migrations/0010_leogram_bio.sql`).
//
// Images never come here. The wallpaper and WillChat's conversation are far too large for rows
// read on every open, and they stay in the browser's localStorage and IndexedDB; a Leogram post's
// photos and videos, which open on any device with its link, go to the project's Neon bucket, and
// here only where they are.
//
// Fields are named after their columns, not in camelCase: the Data API hands rows over as the
// columns are spelled, and `shared/` re-exports `$inferSelect` as the shape the browser works in.
import { sql, type SQL } from 'drizzle-orm';
import { authenticatedRole } from 'drizzle-orm/neon';
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgPolicy,
	pgTable,
	primaryKey,
	smallint,
	text,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

/** Anything that survives `JSON.stringify`, which is all a `jsonb` column ever holds here. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** The account a row belongs to, filled in by Postgres from the token behind the request. */
const account = () =>
	text()
		.notNull()
		.default(sql`auth.user_id()`);

/**
 * Lets an account at its own rows and at nothing else. `using` is what may be read, changed or
 * deleted; `withCheck` what may be written. Both sides are needed: without `withCheck` an account
 * could file a row under someone else's name. `check` is anything else a row has to meet to be
 * written.
 */
const ownRows = (name: string, check?: SQL) =>
	pgPolicy(name, {
		for: 'all',
		to: authenticatedRole,
		using: sql`user_id = auth.user_id()`,
		withCheck: check ? sql`user_id = auth.user_id() and ${check}` : sql`user_id = auth.user_id()`
	});

/**
 * The small preferences each app used to keep in localStorage, under the same prefixed keys:
 * `willchat:text-model`, `me-deben:my-bank`, and so on.
 */
export const settings = pgTable(
	'settings',
	{
		user_id: account(),
		key: text().notNull(),
		value: jsonb().$type<Json>().notNull()
	},
	(table) => [primaryKey({ columns: [table.user_id, table.key] }), ownRows('settings_own')]
).enableRLS();

export const people = pgTable(
	'me_deben_people',
	{
		id: uuid().primaryKey(),
		user_id: account(),
		name: text().notNull()
	},
	(table) => [index('me_deben_people_user').on(table.user_id), ownRows('me_deben_people_own')]
).enableRLS();

export const movements = pgTable(
	'me_deben_movements',
	{
		id: uuid().primaryKey(),
		user_id: account(),
		// Deleting a person takes their whole history with them, which is what the app promises.
		person_id: uuid()
			.notNull()
			.references(() => people.id, { onDelete: 'cascade' }),
		kind: text().$type<'loan' | 'payment'>().notNull(),
		/** Cents, always positive: `kind` is what gives it a sign. */
		amount: bigint({ mode: 'number' }).notNull(),
		date: date().notNull(),
		/** Null with no agreed return date, and with a payment agreement, which replaces it. */
		due_date: date(),
		plan: text().$type<'' | 'weekly' | 'monthly'>().notNull().default(''),
		plan_amount: bigint({ mode: 'number' }).notNull().default(0),
		plan_start: date(),
		from_bank: text().notNull().default(''),
		to_bank: text().notNull().default(''),
		note: text().notNull().default(''),
		/** Epoch milliseconds. It only breaks the tie between movements sharing a date. */
		created_at: bigint({ mode: 'number' }).notNull().default(0)
	},
	(table) => [
		check('me_deben_movements_kind', sql`${table.kind} in ('loan', 'payment')`),
		check('me_deben_movements_amount', sql`${table.amount} > 0`),
		check('me_deben_movements_plan', sql`${table.plan} in ('', 'weekly', 'monthly')`),
		index('me_deben_movements_user').on(table.user_id),
		index('me_deben_movements_person').on(table.person_id),
		ownRows('me_deben_movements_own')
	]
).enableRLS();

/**
 * «Lista»: the one checklist an account has. Starting a new list empties this one, so every row of
 * the account is an item of it.
 */
export const listItems = pgTable(
	'lista_items',
	{
		id: uuid().primaryKey(),
		user_id: account(),
		text: text().notNull(),
		done: boolean().notNull().default(false),
		/** Smallest first. Gaps are fine: removing an item leaves the others where they were. */
		position: integer().notNull()
	},
	(table) => [index('lista_items_user').on(table.user_id), ownRows('lista_items_own')]
).enableRLS();

/** «Repaso»: flashcards studied with spaced repetition, grouped in decks. */
export const decks = pgTable(
	'repaso_decks',
	{
		id: uuid().primaryKey(),
		user_id: account(),
		name: text().notNull(),
		/** How many new cards a day brings at most, as in Anki; 0 is every one of them. */
		new_per_day: integer().notNull().default(0)
	},
	(table) => [index('repaso_decks_user').on(table.user_id), ownRows('repaso_decks_own')]
).enableRLS();

/**
 * A card with its place in the schedule, which `apps/repaso/src/lib/schedule.ts` moves on with
 * every answer. The columns are that file's `Schedule`, spelled out.
 */
export const cards = pgTable(
	'repaso_cards',
	{
		id: uuid().primaryKey(),
		user_id: account(),
		// Deleting a deck takes its cards with it, which is what the app promises.
		deck_id: uuid()
			.notNull()
			.references(() => decks.id, { onDelete: 'cascade' }),
		front: text().notNull(),
		back: text().notNull(),
		state: text().$type<'new' | 'learning' | 'review' | 'relearning'>().notNull().default('new'),
		/** The learning step it is on, while it is being learned or relearned. */
		step: integer().notNull().default(0),
		/** Epoch milliseconds: when it is shown again. Unused while the card is new. */
		due_at: bigint({ mode: 'number' }).notNull().default(0),
		/** Days between reviews, once learned. */
		interval_days: integer().notNull().default(0),
		/** Thousandths: how much the interval grows with each «Bien», 2500 being ×2.5. */
		ease: integer().notNull().default(2500),
		/** Epoch milliseconds. New cards are studied in the order they were added. */
		created_at: bigint({ mode: 'number' }).notNull().default(0),
		/** Epoch milliseconds: when it was first answered, the day it counts among the new. 0 while new. */
		introduced_at: bigint({ mode: 'number' }).notNull().default(0)
	},
	(table) => [
		check('repaso_cards_state', sql`${table.state} in ('new', 'learning', 'review', 'relearning')`),
		index('repaso_cards_user').on(table.user_id),
		index('repaso_cards_deck').on(table.deck_id),
		ownRows('repaso_cards_own')
	]
).enableRLS();

/**
 * «Dictado»: the text an account is writing by voice. There is only ever one — starting a new text
 * empties it — so the account is the whole key.
 */
export const dictations = pgTable(
	'dictado_texts',
	{
		user_id: account().primaryKey(),
		text: text().notNull()
	},
	() => [ownRows('dictado_texts_own')]
).enableRLS();

/**
 * «Leogram»: the name shown with a post and with every comment, to whoever opens the post. An
 * account gets one before it first posts, likes or comments.
 */
export const leogramProfiles = pgTable(
	'leogram_profiles',
	{
		user_id: account().primaryKey(),
		/** As Instagram spells them: lowercase letters, digits, dots and underscores, up to 30. */
		username: text().notNull()
	},
	(table) => [
		check('leogram_profiles_username', sql`${table.username} ~ '^[a-z0-9._]{1,30}$'`),
		uniqueIndex('leogram_profiles_username_unique').on(table.username),
		ownRows('leogram_profiles_own')
	]
).enableRLS();

/**
 * Where a profile's photo is in the bucket. It has no policy: only the functions in
 * `migrations/0007_leogram_public.sql`, which sign the upload, write it — a key written by hand
 * could point at someone else's photo, which the next change of photo would then delete.
 */
export const leogramAvatars = pgTable('leogram_avatars', {
	user_id: account()
		.primaryKey()
		.references(() => leogramProfiles.user_id, { onDelete: 'cascade' }),
	key: text().notNull().unique(),
	/** Bytes: the upload is signed for exactly this many. */
	size: bigint({ mode: 'number' }).notNull()
}).enableRLS();

/** A post's song: where it plays from, and the moment of it that plays. */
export interface LeogramMusic {
	/**
	 * `catalog`: the 30-second preview Apple serves of a song of its catalog, played from `url`.
	 * `upload`: a clip cut from a file of the author's own, kept in the bucket at slot -1.
	 */
	source: 'catalog' | 'upload';
	title: string;
	artist: string;
	/** The album cover, from Apple; '' for an uploaded song. */
	artwork: string;
	/** The preview's address; '' for an uploaded song. */
	url: string;
	/** Seconds into that audio where the post's music starts… */
	start: number;
	/** …and how many it plays before it starts over. */
	length: number;
}

/**
 * A post: a carousel of photos and videos with a caption and a song. Only its author can list them
 * here; anyone else reaches one by its link, whose code is its key, or in its author's bio when it
 * is listed there — `leogram_post()` and `leogram_profile()` in the migrations, which ask
 * `leogram_can_see()` who may.
 */
export const leogramPosts = pgTable(
	'leogram_posts',
	{
		/** The code in its link (`?p=`): eleven random characters, short and still unguessable. */
		id: text().primaryKey(),
		// A post is shown with its author's name and face, so there has to be a profile behind it.
		user_id: account().references(() => leogramProfiles.user_id, { onDelete: 'cascade' }),
		caption: text().notNull().default(''),
		/** The shape every photo is cut to, as Instagram has them: 1:1, 4:5 or 1.91:1. */
		aspect: text().$type<'square' | 'portrait' | 'landscape'>().notNull(),
		/** How many photos and videos it has, in `leogram_media` at slots 0 to slides − 1. */
		slides: integer().notNull(),
		music: jsonb().$type<LeogramMusic>(),
		/** Epoch milliseconds. */
		created_at: bigint({ mode: 'number' }).notNull().default(0),
		/**
		 * Who opens it: `link`, anybody with its link, signed in or not; `friends`, only its author
		 * and the accounts in `leogram_audience`, signed in. Posts from before there was a choice
		 * are `link`, which is what they had always been.
		 */
		audience: text().$type<'link' | 'friends'>().notNull().default('link'),
		/**
		 * Whether its author's bio lists it, to whoever can open it: everybody for `link`, those
		 * friends for `friends`. Unlisted, nobody comes across it but through its link.
		 */
		listed: boolean().notNull().default(false)
	},
	(table) => [
		check('leogram_posts_id', sql`${table.id} ~ '^[A-Za-z0-9_-]{11}$'`),
		check('leogram_posts_aspect', sql`${table.aspect} in ('square', 'portrait', 'landscape')`),
		check('leogram_posts_slides', sql`${table.slides} between 1 and 10`),
		check('leogram_posts_caption', sql`char_length(${table.caption}) <= 2200`),
		check('leogram_posts_audience', sql`${table.audience} in ('link', 'friends')`),
		index('leogram_posts_user').on(table.user_id),
		ownRows('leogram_posts_own')
	]
).enableRLS();

/**
 * Who a post for some friends only is for, besides its author: one row per friend. Like
 * `leogram_media`, it has no policy: `leogram_share()` writes it, for the post's author alone, and
 * `leogram_can_see()` reads it.
 */
export const leogramAudience = pgTable(
	'leogram_audience',
	{
		post_id: text()
			.notNull()
			.references(() => leogramPosts.id, { onDelete: 'cascade' }),
		/** The post's author. */
		user_id: account(),
		friend_id: text()
			.notNull()
			.references(() => leogramProfiles.user_id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.post_id, table.friend_id] }),
		check('leogram_audience_not_author', sql`${table.friend_id} <> ${table.user_id}`),
		index('leogram_audience_friend').on(table.friend_id)
	]
).enableRLS();

/**
 * The accounts an account keeps at hand to share posts with: the first ones the composer offers
 * when a post is for some friends only. They are found by username (`leogram_find()`), and
 * `leogram_mine()` reads them back with their names and faces, which only it may.
 */
export const leogramFavorites = pgTable(
	'leogram_favorites',
	{
		user_id: account(),
		friend_id: text()
			.notNull()
			.references(() => leogramProfiles.user_id, { onDelete: 'cascade' })
	},
	(table) => [
		primaryKey({ columns: [table.user_id, table.friend_id] }),
		check('leogram_favorites_not_self', sql`${table.friend_id} <> ${table.user_id}`),
		index('leogram_favorites_friend').on(table.friend_id),
		ownRows('leogram_favorites_own')
	]
).enableRLS();

/**
 * A post's files, kept in the project's Neon bucket: a row is where one is and what it is. The
 * browser sends each one straight to the bucket, to an address `leogram_upload()` signs, and reads
 * them from addresses `leogram_post()` signs; the bucket itself is private. Like `leogram_avatars`,
 * it has no policy: only those functions write it, so that every key in it is one they made.
 */
export const leogramMedia = pgTable(
	'leogram_media',
	{
		post_id: text()
			.notNull()
			.references(() => leogramPosts.id, { onDelete: 'cascade' }),
		user_id: account(),
		/** 0 to slides − 1 for the carousel, in its order; -1 for the song's clip. */
		slot: integer().notNull(),
		/**
		 * An item of the carousel, `photo` or `video`; a video's `poster`, the frame it shows before
		 * it plays; `thumb`, the grid's square of slot 0; or the `song`'s clip.
		 */
		kind: text().$type<'photo' | 'video' | 'poster' | 'thumb' | 'song'>().notNull(),
		/** Where it is in the bucket: `<schema>/<post>/<kind><slot>-<random>.<extension>`. */
		key: text().notNull().unique(),
		/** Its MIME type, and its size in bytes: the upload is signed for exactly these. */
		type: text().notNull(),
		size: bigint({ mode: 'number' }).notNull(),
		/** Where a video sits in its frame, from 0 to 100 across and down; a photo comes cut already. */
		focus_x: smallint().notNull().default(50),
		focus_y: smallint().notNull().default(50)
	},
	(table) => [
		primaryKey({ columns: [table.post_id, table.slot, table.kind] }),
		check('leogram_media_slot', sql`${table.slot} between -1 and 9`),
		check('leogram_media_kind', sql`${table.kind} in ('photo', 'video', 'poster', 'thumb', 'song')`),
		check('leogram_media_song', sql`(${table.kind} = 'song') = (${table.slot} = -1)`),
		check('leogram_media_focus_x', sql`${table.focus_x} between 0 and 100`),
		check('leogram_media_focus_y', sql`${table.focus_y} between 0 and 100`),
		index('leogram_media_user').on(table.user_id)
	]
).enableRLS();

/**
 * Who a post's likes and comments may come from: whoever can open it. A post for some friends only
 * takes theirs alone, even from someone else who got hold of its link.
 */
const canSee = (postId: AnyPgColumn) => sql`leogram_can_see(${postId})`;

/** One row per account that likes a post. Liking takes an account, which is what makes it one each. */
export const leogramLikes = pgTable(
	'leogram_likes',
	{
		post_id: text()
			.notNull()
			.references(() => leogramPosts.id, { onDelete: 'cascade' }),
		user_id: account()
	},
	(table) => [
		primaryKey({ columns: [table.post_id, table.user_id] }),
		index('leogram_likes_user').on(table.user_id),
		ownRows('leogram_likes_own', canSee(table.post_id))
	]
).enableRLS();

export const leogramComments = pgTable(
	'leogram_comments',
	{
		id: uuid().primaryKey(),
		post_id: text()
			.notNull()
			.references(() => leogramPosts.id, { onDelete: 'cascade' }),
		// Shown with its author's name and face, like a post.
		user_id: account().references(() => leogramProfiles.user_id, { onDelete: 'cascade' }),
		text: text().notNull(),
		/** Epoch milliseconds. */
		created_at: bigint({ mode: 'number' }).notNull().default(0)
	},
	(table) => [
		check('leogram_comments_text', sql`char_length(${table.text}) between 1 and 2200`),
		index('leogram_comments_post').on(table.post_id),
		index('leogram_comments_user').on(table.user_id),
		ownRows('leogram_comments_own', canSee(table.post_id)),
		// Whoever wrote the post may take any comment off it, as on Instagram. A delete only finds
		// the rows it may also read, hence the two.
		...(['select', 'delete'] as const).map((command) =>
			pgPolicy(`leogram_comments_post_author_${command}`, {
				for: command,
				to: authenticatedRole,
				using: sql`exists (select from leogram_posts p where p.id = ${table.post_id} and p.user_id = auth.user_id())`
			})
		)
	]
).enableRLS();

/**
 * «Transforma»: a prompt, the instructions a text is rewritten with. It is shown by the name the
 * user gave it or, while it has none, by the one the app gave it.
 */
export const transformaPrompts = pgTable(
	'transforma_prompts',
	{
		id: uuid().primaryKey(),
		user_id: account(),
		/** What the user named it; '' leaves the name to the app. */
		title: text().notNull().default(''),
		/** The name the app gave it, out of its instructions, for as long as `title` is empty. */
		auto_title: text().notNull().default(''),
		/** What a text is to become, in the user's words: what the chat model is told. */
		instructions: text().notNull(),
		/** Epoch milliseconds. */
		created_at: bigint({ mode: 'number' }).notNull().default(0)
	},
	(table) => [index('transforma_prompts_user').on(table.user_id), ownRows('transforma_prompts_own')]
).enableRLS();

/** A version of the text in «Transforma», as its history keeps it. */
export interface TransformaVersion {
	text: string;
	/**
	 * The prompt that made it, by the name it had then. None for a version typed, pasted or
	 * cleared: only a prompt's own can be shown with what it changed.
	 */
	prompt?: string;
}

/**
 * «Transforma»: the text every prompt works on, with the versions it went through — what undo,
 * redo and the changes view walk, kept so that they still work after the app is closed. There is
 * only ever one text, so the account is the whole key.
 */
export const transformaTexts = pgTable(
	'transforma_texts',
	{
		user_id: account().primaryKey(),
		/** Oldest first. The app keeps the last few. */
		versions: jsonb().$type<TransformaVersion[]>().notNull(),
		/** Which of them is on screen. */
		current: integer().notNull()
	},
	() => [ownRows('transforma_texts_own')]
).enableRLS();

// What the browser reads and writes. `shared/` re-exports these, so a column is described once:
// rename one here and the apps stop typechecking until they follow.
export type SettingRow = typeof settings.$inferSelect;
export type PersonRow = typeof people.$inferSelect;
export type MovementRow = typeof movements.$inferSelect;
export type ListItemRow = typeof listItems.$inferSelect;
export type DeckRow = typeof decks.$inferSelect;
export type CardRow = typeof cards.$inferSelect;
export type DictationRow = typeof dictations.$inferSelect;
export type LeogramProfileRow = typeof leogramProfiles.$inferSelect;
export type LeogramAvatarRow = typeof leogramAvatars.$inferSelect;
export type LeogramPostRow = typeof leogramPosts.$inferSelect;
export type LeogramAudienceRow = typeof leogramAudience.$inferSelect;
export type LeogramFavoriteRow = typeof leogramFavorites.$inferSelect;
export type LeogramMediaRow = typeof leogramMedia.$inferSelect;
export type LeogramLikeRow = typeof leogramLikes.$inferSelect;
export type LeogramCommentRow = typeof leogramComments.$inferSelect;
export type TransformaPromptRow = typeof transformaPrompts.$inferSelect;
export type TransformaTextRow = typeof transformaTexts.$inferSelect;
