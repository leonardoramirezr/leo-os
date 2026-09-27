// A copy of what the database holds, kept in localStorage so an app paints its data before the
// network answers and still shows it with no connection. The database is what counts: the cache is
// replaced whole every time a query comes back.
//
// The key carries the account, so signing in with another one on the same phone never shows the
// previous account's rows. Signing out drops every cache on the origin.
//
// It carries the schema too when the rows come from a preview's: a preview shares this origin, and
// so this storage, with the published site, and neither may paint the other's rows.
import { dataApiSchema } from './config';

/** Every app's caches share this marker, which is what `clearCaches` looks for. */
const MARKER = ':cache:';

const SCHEMA = dataApiSchema ? `${dataApiSchema}:` : '';

function read<T>(key: string): T | undefined {
	try {
		const raw = localStorage.getItem(key);
		return raw === null ? undefined : (JSON.parse(raw) as T);
	} catch {
		// No storage, or something an earlier version wrote: as good as nothing kept.
		return undefined;
	}
}

function write(key: string, value: unknown): boolean {
	try {
		localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

export function readCache<T>(prefix: string, userId: string): T | undefined {
	return read(`${prefix}${MARKER}${SCHEMA}${userId}`);
}

/** Says whether it made it: storage may be full, or blocked, and some callers have to tell. */
export function writeCache(prefix: string, userId: string, value: unknown): boolean {
	return write(`${prefix}${MARKER}${SCHEMA}${userId}`, value);
}

/**
 * The same for a value that never reaches the database — an image — and only ever lives on the
 * device. There is no schema behind it, so the published site and its previews share it.
 */
export function readLocal<T>(prefix: string, userId: string): T | undefined {
	return read(`${prefix}${MARKER}${userId}`);
}

export function writeLocal(prefix: string, userId: string, value: unknown): boolean {
	return write(`${prefix}${MARKER}${userId}`, value);
}

/** Drops every account's cache. Called on sign-out: nothing of theirs is left on the device. */
export function clearCaches() {
	try {
		const keys = Object.keys(localStorage).filter((key) => key.includes(MARKER));
		for (const key of keys) localStorage.removeItem(key);
	} catch {
		// No storage: there is nothing cached to drop.
	}
}
