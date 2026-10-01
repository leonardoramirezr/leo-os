// The account's own side of Leogram, read in one go by `leogram_mine()`: its username and photo,
// and its posts, newest first, with their thumbnails. The photo and the thumbnails are in the
// bucket, so what comes are addresses the database signed for them, good for a day at least.
import type { LeogramPostRow } from '@leo-os/shared';
import { call } from './post';

/** A post as the grid shows it. */
export interface OwnPost
	extends Pick<LeogramPostRow, 'id' | 'caption' | 'aspect' | 'slides' | 'music' | 'created_at'> {
	/** Its thumbnail's address; null if it never got there. */
	thumb: string | null;
	/** Whether a video is among its slides. */
	video: boolean;
}

export interface Mine {
	/** Null until the account has picked one. */
	username: string | null;
	/** The profile photo's address; null for none. */
	avatar: string | null;
	/** How many bytes the account's files take in the bucket. */
	used: number;
	posts: OwnPost[];
}

export function readMine(): Promise<Mine> {
	return call<Mine>('leogram_mine');
}
