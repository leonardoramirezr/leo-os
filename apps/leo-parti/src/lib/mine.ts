// The account's own side of Leo Partī, read in one go by `leogram_mine()`: its username and photo,
// its posts, newest first, with their thumbnails, and its favourites. The photos and the thumbnails
// are in the bucket, so what comes are addresses the database signed for them, good for a day at
// least.
import type { LeogramPostRow } from '@leo-os/shared';
import type { Tile } from './bio';
import type { Person } from './people.svelte';
import { call } from './post';

/** A post as the grid shows it, and who it is for. */
export interface OwnPost
	extends Tile,
		Pick<LeogramPostRow, 'caption' | 'aspect' | 'created_at' | 'listed'> {}

export interface Mine {
	/** Null until the account has picked one. */
	username: string | null;
	/** The profile photo's address; null for none. */
	avatar: string | null;
	/** How many bytes the account's files take in the bucket. */
	used: number;
	posts: OwnPost[];
	/** The accounts it keeps at hand to share posts with, by username. */
	favorites: Person[];
}

export function readMine(): Promise<Mine> {
	return call<Mine>('leogram_mine');
}
