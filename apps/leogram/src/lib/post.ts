// A post as whoever opens its link sees it, from `leogram_post()` (see
// db/migrations/0012_leogram_bio.sql). It answers signed out as well, which is what lets a link
// open for anybody; liking and commenting need an account, and go to the tables like any write.
// A post for some friends only opens for them, signed in, and its author; to anyone else the link
// only says that much.
import { eq, insert, remove, rpc, upsert, type LeogramMusic, type LeogramPostRow } from '@leo-os/shared';
import { drop } from './bucket';
import { newId } from './code';
import type { Aspect } from './images';
import type { Person } from './people.svelte';

/** `link`: anybody with its link, signed in or not. `friends`: some friends only, signed in. */
export type Audience = LeogramPostRow['audience'];

/** Who a post is for, and whether its author's bio lists it, to those same people. */
export interface Visibility {
	audience: Audience;
	listed: boolean;
	/** Who a post for some friends is for, besides its author; none for one for anybody. */
	friends: Person[];
}

/** A photo or a video of the carousel. Its addresses are signed for a day at least. */
export interface Item {
	/** Its place in the carousel, from 0. */
	slot: number;
	kind: 'photo' | 'video';
	url: string;
	/** A video's poster, the frame that shows until it plays. */
	poster: string | null;
	/** Where a video sits in its frame, from 0 to 100 across and down; a photo comes cut already. */
	focus_x: number;
	focus_y: number;
}

export interface CommentView {
	id: string;
	username: string;
	text: string;
	created_at: number;
	/** Written by whoever is looking. */
	mine: boolean;
}

export interface PostView {
	id: string;
	username: string;
	caption: string;
	aspect: Aspect;
	slides: number;
	music: LeogramMusic | null;
	created_at: number;
	items: Item[];
	/** Where the clip of a song of the author's own plays from; null for a catalog song, or none. */
	song: string | null;
	/** Written by whoever is looking. */
	mine: boolean;
	likes: number;
	liked: boolean;
	comments: CommentView[];
	/** The faces of everyone shown, by username; whoever has none is not there. */
	avatars: Record<string, string>;
	/** The username of whoever is looking; null signed out, or without a profile yet. */
	me: string | null;
	audience: Audience;
	listed: boolean;
	/** Who a post for some friends is for: only its author is told. */
	friends: Person[] | null;
}

/** What a post for some friends only answers to anyone else: that much, and nothing of it. */
export interface Restricted {
	restricted: true;
}

/** The slot of a post's song among its files. */
export const SONG = -1;

/**
 * Calls one of Leogram's functions and gives back what it answered. PostgREST answers a function
 * of one value with that value itself, a list included; the same value as a row named after the
 * function — `[{ "leogram_post": … }]` — is taken as well. `visitor` lets it go out signed out,
 * for `leogram_post`.
 */
export async function call<T>(
	name: string,
	args: Record<string, unknown> = {},
	options?: { visitor?: boolean }
): Promise<T> {
	const answer: unknown = await rpc(name, args, options);
	const row: unknown = Array.isArray(answer) && answer.length === 1 ? answer[0] : answer;
	const named = row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).length === 1;
	if (named && name in row) return (row as Record<string, T>)[name];
	return answer as T;
}

/** The post, or null when there is none with that code (or it was deleted). */
export function readPost(code: string): Promise<PostView | Restricted | null> {
	return call<PostView | Restricted | null>('leogram_post', { code }, { visitor: true });
}

/**
 * Says who a post of one's own is for and whether the bio lists it, all at once: its link stops
 * opening for whoever is left out in the same moment it opens for whoever is added.
 */
export async function share(code: string, { audience, listed, friends }: Visibility): Promise<void> {
	const ids = audience === 'friends' ? friends.map((friend) => friend.id) : [];
	await call<boolean>('leogram_share', { code, audience, listed, friends: ids });
}

export function like(code: string, userId: string): Promise<void> {
	// Liking twice is still one like: the second finds the row already there.
	return upsert('leogram_likes', { post_id: code, user_id: userId });
}

export function unlike(code: string, userId: string): Promise<void> {
	return remove('leogram_likes', `${eq('post_id', code)}&${eq('user_id', userId)}`);
}

/** Adds a comment, and gives back how it shows until the post is read again. */
export async function addComment(code: string, username: string, text: string): Promise<CommentView> {
	const comment = { id: newId(), post_id: code, text, created_at: Date.now() };
	await insert('leogram_comments', comment);
	return { id: comment.id, username, text, created_at: comment.created_at, mine: true };
}

/** Takes a comment off: the policies let its author do it, and the post's. */
export function removeComment(id: string): Promise<void> {
	return remove('leogram_comments', eq('id', id));
}

/** Deletes a post, with its likes and comments, and then its files from the bucket. */
export async function deletePost(code: string): Promise<void> {
	drop(await call<string[]>('leogram_delete_post', { code }));
}
