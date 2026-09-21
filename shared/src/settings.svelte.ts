// The small preferences each app used to keep in localStorage under its own prefix. They now live
// in one `settings` table, one row per account and key, and each key keeps the prefix it had.
//
// Reading and writing looks the same as before — `setting.value` — so the apps barely changed
// around it. What did change is that the value arrives a moment after the app opens, which is why
// `Account` waits for `loadSettings` before drawing anything.
import { readCache, writeCache } from './cache';
import type { Json } from './database';
import * as db from './db';
import { pull, push } from './sync.svelte';

const TABLE = 'settings';

class Setting<T> {
	#value: T = $state()!;
	#fallback: T;

	readonly key: string;

	constructor(key: string, fallback: T) {
		this.key = key;
		this.#fallback = fallback;
		this.#value = fallback;
	}

	get value(): T {
		return this.#value;
	}

	set value(next: T) {
		const previous = this.#value;
		this.#value = next;

		// Before anyone is signed in nothing is stored: `Account` draws no app until there is.
		if (!account) return;

		this.#keep(next as Json);
		push(
			() => db.upsert(TABLE, { user_id: account, key: this.key, value: next }),
			// One value, and the one it had before is right here: there is nothing to go and read.
			() => {
				this.#value = previous;
				this.#keep(previous as Json);
			}
		);
	}

	#keep(value: Json) {
		stored[this.key] = value;
		writeCache(TABLE, account, stored);
	}

	/** Takes what the database (or the cache) holds, falling back to the built-in default. */
	adopt(value: Json | undefined) {
		this.#value = value === undefined || value === null ? this.#fallback : (value as T);
	}
}

const declared: Setting<unknown>[] = [];
let stored: Record<string, Json> = {};
let account = '';

/**
 * Declares a preference. Apps call this at module level, before anyone is signed in: the value
 * starts as `fallback` and is filled in by `loadSettings`.
 */
export function setting<T>(key: string, fallback: T): Setting<T> {
	const entry = new Setting(key, fallback);
	declared.push(entry as Setting<unknown>);
	return entry;
}

/** Reads every declared preference of this account in one query. Never throws. */
export async function loadSettings(userId: string) {
	account = userId;
	stored = readCache<Record<string, Json>>(TABLE, userId) ?? {};
	for (const entry of declared) entry.adopt(stored[entry.key]);

	const rows = await pull(() => db.select<{ key: string; value: Json }>(TABLE, 'key,value'));
	if (!rows) return;

	stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
	writeCache(TABLE, userId, stored);
	for (const entry of declared) entry.adopt(stored[entry.key]);
}
