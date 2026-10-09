// An account's bio (`?u=<username>`), the one page of Leo Partī that lists posts to others: the ones
// its author lists there, to whoever can open each one — everybody for a post for anybody with its
// link, and only those friends for one for some friends (`leogram_profile()` in
// db/migrations/0012_leogram_bio.sql). Like a post's link, it opens signed in or not.
import type { LeogramPostRow } from '@leo-os/shared';
import { call } from './post';

/** A post as a grid shows it: its thumbnail, and what the marks in its corners say of it. */
export interface Tile extends Pick<LeogramPostRow, 'id' | 'slides' | 'music' | 'audience'> {
	/** Its thumbnail's address; null if it never got there. */
	thumb: string | null;
	/** Whether a video is among its slides. */
	video: boolean;
}

export interface Bio {
	/** The account's id: what keeps it among one's favourites. */
	id: string;
	username: string;
	/** Its photo's address; null for none. */
	avatar: string | null;
	/** Whether it is the bio of whoever is looking. */
	mine: boolean;
	/** Whether whoever is looking keeps the account among their favourites. */
	favorite: boolean;
	/** What it lists that whoever is looking can open, newest first. */
	posts: Tile[];
	/** The username of whoever is looking; null signed out, or without a profile yet. */
	me: string | null;
}

/** The bio, or null when nobody has that username (any more). */
export function readBio(username: string): Promise<Bio | null> {
	return call<Bio | null>('leogram_profile', { username }, { visitor: true });
}
