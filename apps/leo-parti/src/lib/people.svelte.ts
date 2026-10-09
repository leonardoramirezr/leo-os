// The other accounts of Leo Partī, as an author picks who a post is for: found by username, and kept
// at hand as favourites, which is what makes picking them again, post after post, take one tap.
import {
	eq,
	pull,
	push,
	readCache,
	remove,
	upsert,
	writeCache,
	type LeogramFavoriteRow
} from '@leo-os/shared';
import { readMine } from './mine';
import { call } from './post';

const TABLE = 'leogram_favorites';
const CACHE = 'leogram-favorites';

/** An account as the picker shows it. */
export interface Person {
	id: string;
	username: string;
	/** Its photo's address, signed for a day at least; null for none. */
	avatar: string | null;
}

/** Accounts whose username has `query` in it, those that start with it first; never one's own. */
export function findPeople(query: string): Promise<Person[]> {
	return call<Person[]>('leogram_find', { query });
}

/** As the database lists them: by username, letter by letter. */
function byUsername(a: Person, b: Person): number {
	return a.username < b.username ? -1 : a.username > b.username ? 1 : 0;
}

class Favorites {
	list = $state<Person[]>([]);

	#account = '';

	/** Shows what the device kept from the last time, until the database is read. */
	restore(userId: string) {
		this.#account = userId;
		const cached = readCache<Person[]>(CACHE, userId);
		this.list = Array.isArray(cached) ? cached : [];
	}

	/** The favourites as the database has them. */
	adopt(list: Person[]) {
		this.list = list;
		this.#keep();
	}

	/**
	 * Reads them for a screen the app's door did not open, a post's own link, where nothing has
	 * read them yet. Inside the app they are read with everything else, and this does nothing.
	 */
	async ensure(userId: string) {
		if (this.#account === userId) return;
		this.restore(userId);
		const mine = await pull(readMine);
		if (mine && this.#account === userId) this.adopt(mine.favorites);
	}

	has(id: string): boolean {
		return this.list.some((person) => person.id === id);
	}

	/** Keeps someone among the favourites, or stops keeping them. */
	toggle(person: Person) {
		const had = this.has(person.id);
		this.list = had
			? this.list.filter((kept) => kept.id !== person.id)
			: [...this.list, person].sort(byUsername);
		this.#keep();

		const row: LeogramFavoriteRow = { user_id: this.#account, friend_id: person.id };
		push(
			() =>
				had
					? remove(TABLE, `${eq('user_id', row.user_id)}&${eq('friend_id', row.friend_id)}`)
					: upsert(TABLE, row),
			() => this.#read()
		);
	}

	async #read() {
		const mine = await pull(readMine);
		if (mine) this.adopt(mine.favorites);
	}

	#keep() {
		writeCache(CACHE, this.#account, $state.snapshot(this.list));
	}
}

export const favorites = new Favorites();
