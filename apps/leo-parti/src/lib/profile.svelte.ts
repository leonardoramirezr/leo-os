// Who the account is on Leo Partī: the username and photo shown with its posts and its comments, to
// everyone who opens them. Unlike the rest of Leo OS, it is seen by others: no email, no real name
// unless it is typed in as the username. The photo is in the bucket, like the posts' files.
import {
	insert,
	pull,
	readCache,
	select,
	upsert,
	writeCache,
	type LeogramProfileRow
} from '@leo-os/shared';
import { drop, send, type Signed } from './bucket';
import { readMine, type Mine } from './mine';
import { call } from './post';

const TABLE = 'leogram_profiles';
const CACHE = 'leogram-profile';

/** What a username may be, as Instagram has them; the database holds to the same. */
export const USERNAME = /^[a-z0-9._]{1,30}$/;

/** What the database's refusal means, said in Spanish. */
function reason(thrown: unknown): string {
	const code = (thrown as { code?: unknown } | null)?.code;
	if (code === '23505') return 'Ese nombre de usuario ya lo tiene alguien más.';
	if (code === '23514') return 'Usa solo minúsculas, números, puntos y guiones bajos.';
	return thrown instanceof Error && thrown.message ? thrown.message : 'No se pudo guardar el perfil.';
}

/** «Leo Ramírez» → «leo.ramirez»: a username out of a name, or out of an email's first half. */
export function suggestUsername(name: string, email: string): string {
	const clean = (text: string) =>
		text
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/\s+/g, '.')
			.replace(/[^a-z0-9._]/g, '')
			.replace(/\.{2,}/g, '.')
			.replace(/^\.+|\.+$/g, '')
			.slice(0, 30);
	return clean(name) || clean(email.split('@')[0]) || 'leoparti';
}

class Profile {
	username = $state('');
	/** The photo's address, signed for a day at least; '' for none. */
	avatar = $state('');

	#account = '';

	/** Shows what the device kept from the last time, until the database is read. */
	restore(userId: string) {
		this.#account = userId;
		const cached = readCache<{ username: string; avatar: string }>(CACHE, userId);
		if (cached) this.#adopt(cached);
	}

	/** The profile as the database has it. */
	adopt(mine: Mine) {
		this.#adopt({ username: mine.username ?? '', avatar: mine.avatar ?? '' });
		this.#save();
	}

	/**
	 * Saves the username, and the photo when it changed: a new one, or null to take it off. What
	 * the database refuses comes back as a sentence to show.
	 */
	async save(username: string, photo?: Blob | null) {
		try {
			await upsert(TABLE, { user_id: this.#account, username });
		} catch (thrown) {
			throw new Error(reason(thrown));
		}

		// After the username: there is no photo without a profile to show it with.
		if (photo) {
			const signed = await call<Signed>('leogram_upload_avatar', { size: photo.size });
			await send(signed, photo);
			drop([signed.drop]);
		} else if (photo === null) {
			drop([await call<string | null>('leogram_remove_avatar')]);
		}

		// The photo's address is the database's to sign. Without it, the one on the device shows
		// until the next time.
		const mine = await pull(readMine);
		if (mine) {
			this.adopt(mine);
		} else {
			const avatar = photo ? URL.createObjectURL(photo) : photo === null ? '' : this.avatar;
			this.#adopt({ username, avatar });
		}
	}

	#adopt(row: { username: string; avatar: string }) {
		this.username = row.username;
		this.avatar = row.avatar;
	}

	#save() {
		writeCache(CACHE, this.#account, { username: this.username, avatar: this.avatar });
	}
}

export const profile = new Profile();

/**
 * Gives an account that has none a profile, before its first like or comment: a username out of
 * its name, with a number on the end if someone has it already. Gives back that username.
 */
export async function createProfile(name: string, email: string): Promise<string> {
	// Made since the post was read, on another tab or in the app itself: that one stays.
	const [existing] = await select<Pick<LeogramProfileRow, 'username'>>(TABLE, 'username');
	if (existing) return existing.username;

	const base = suggestUsername(name, email);
	for (let attempt = 0; attempt < 6; attempt++) {
		const suffix = attempt === 0 ? '' : String(Math.floor(Math.random() * 10 ** (attempt + 1)));
		const username = base.slice(0, 30 - suffix.length) + suffix;
		try {
			await insert(TABLE, { username });
			return username;
		} catch (thrown) {
			if ((thrown as { code?: unknown } | null)?.code !== '23505') throw thrown;
		}
	}
	throw new Error('No se pudo elegir un nombre de usuario.');
}
