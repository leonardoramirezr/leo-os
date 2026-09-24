// Values that stay on the device: images, which are far too large for rows read on every open, and
// caches of things the network can hand over again.
//
// They still belong to one account. The key carries it, so two people using the same phone never
// see each other's wallpaper or each other's conversation, and signing out drops the lot.
import { readLocal, writeLocal } from './cache';

class Local<T> {
	#value: T = $state()!;
	#fallback: T;
	#stored = $state(true);

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
		this.#value = next;
		this.#stored = account ? writeLocal(this.key, account, next) : false;
	}

	/** Whether the last value written made it. False when storage is full, or blocked. */
	get stored(): boolean {
		return this.#stored;
	}

	adopt(userId: string) {
		this.#value = readLocal<T>(this.key, userId) ?? this.#fallback;
		this.#stored = true;
	}
}

const declared: Local<unknown>[] = [];
let account = '';

/** Declared at module level, like `setting`, and filled in by `bindLocal`. */
export function local<T>(key: string, fallback: T): Local<T> {
	const entry = new Local(key, fallback);
	declared.push(entry as Local<unknown>);
	return entry;
}

/** Points every declared value at this account's copy. `Account` runs it before drawing anything. */
export function bindLocal(userId: string) {
	account = userId;
	for (const entry of declared) entry.adopt(userId);
}
