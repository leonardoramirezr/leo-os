// A copy of what the database holds, kept in localStorage so an app paints its data before the
// network answers and still shows it with no connection. The database is what counts: the cache is
// replaced whole every time a query comes back.
//
// The key carries the account, so signing in with another one on the same phone never shows the
// previous account's rows. Signing out drops every cache on the origin.

/** Every app's caches share this marker, which is what `clearCaches` looks for. */
const MARKER = ':cache:';

function cacheKey(prefix: string, userId: string): string {
	return `${prefix}${MARKER}${userId}`;
}

export function readCache<T>(prefix: string, userId: string): T | undefined {
	try {
		const raw = localStorage.getItem(cacheKey(prefix, userId));
		return raw === null ? undefined : (JSON.parse(raw) as T);
	} catch {
		// No storage, or a cache written by an earlier version: the query will fill it again.
		return undefined;
	}
}

/** Says whether it made it: storage may be full, or blocked, and some callers have to tell. */
export function writeCache(prefix: string, userId: string, value: unknown): boolean {
	try {
		localStorage.setItem(cacheKey(prefix, userId), JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
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
