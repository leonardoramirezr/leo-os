// A post as whoever opens its link sees it, from `leogram_post()` and `leogram_file()` (see
// db/migrations/0007_leogram_public.sql). They answer signed out as well, which is what lets a link
// open for anybody; liking and commenting need an account, and go to the tables like any write.
import { eq, insert, remove, rpc, upsert, type LeogramMusic } from '@leo-os/shared';
import { newId } from './code';
import type { Aspect } from './images';

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
	/** Written by whoever is looking. */
	mine: boolean;
	likes: number;
	liked: boolean;
	comments: CommentView[];
	/** The faces of everyone shown, by username; whoever has none is not there. */
	avatars: Record<string, string>;
	/** The username of whoever is looking; null signed out, or without a profile yet. */
	me: string | null;
}

/** The slot of a post's song among its files. */
export const SONG = -1;

/**
 * What a function gave back. PostgREST answers a function of one value with that value itself;
 * the same value as a row — `[{ "leogram_file": … }]` — is taken as well.
 */
function single<T>(answer: unknown, name: string): T | null {
	const row: unknown = Array.isArray(answer) ? (answer[0] ?? null) : answer;
	if (row && typeof row === 'object' && Object.keys(row).length === 1 && name in row) {
		return (row as Record<string, T>)[name];
	}
	return row as T | null;
}

/** The post, or null when there is none with that code (or it was deleted). */
export async function readPost(code: string): Promise<PostView | null> {
	return single(await rpc('leogram_post', { code }, { visitor: true }), 'leogram_post');
}

/** One of its files as a data URL: slot 0 onwards for the photos, SONG for the song's clip. */
export async function readFile(code: string, slot: number): Promise<string | null> {
	return single(await rpc('leogram_file', { code, slot }, { visitor: true }), 'leogram_file');
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

export function removePost(code: string): Promise<void> {
	// Its photos, song, likes and comments go with it (ON DELETE CASCADE).
	return remove('leogram_posts', eq('id', code));
}

/** A data URL as a file of its own, for <audio>: Safari plays a long data URL badly, if at all. */
export async function objectUrl(url: string): Promise<string> {
	const blob = await (await fetch(url)).blob();
	return URL.createObjectURL(blob);
}
