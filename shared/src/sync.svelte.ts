// Every app talks to the database the same way: apply the change on screen first, so the app
// answers as fast as it did when everything lived in localStorage, then send it.
//
// Writes go out one at a time and in the order they were made — a movement must not reach the
// database before the person it points at — and each one says how to get back in step if it is
// refused. The reason shows up in the banner `Account` draws over every app.
import { isExpired } from './db';
import { session } from './session.svelte';

export const sync = $state({
	/** Writes made and not yet answered. */
	pending: 0,
	/** Why the last one did not make it, or '' when everything is saved. */
	error: ''
});

let queue: Promise<unknown> = Promise.resolve();

function reason(thrown: unknown, fallback: string): string {
	const message = thrown instanceof Error ? thrown.message.trim() : '';
	return message || fallback;
}

/**
 * Sends a change that is already on screen. `recover` runs if the database refuses it or cannot
 * be reached, and its job is to put back whatever the database actually holds.
 */
export function push(run: () => Promise<void>, recover: () => unknown): Promise<void> {
	sync.pending++;

	queue = queue.then(async () => {
		try {
			await run();
			// The last one in the queue went through: whatever failed before is behind us.
			if (sync.pending === 1) sync.error = '';
		} catch (thrown) {
			if (isExpired(thrown)) session.expire();
			else sync.error = reason(thrown, 'No se pudo guardar el cambio.');
			await recover();
		} finally {
			sync.pending--;
		}
	});

	return queue as Promise<void>;
}

/**
 * Reads. There is nothing to undo: a failure leaves on screen whatever was there, and says so.
 * Gives back the rows, or `undefined` when the query did not make it.
 */
export async function pull<T>(run: () => Promise<T>): Promise<T | undefined> {
	try {
		return await run();
	} catch (thrown) {
		if (isExpired(thrown)) session.expire();
		else sync.error = reason(thrown, 'No se pudieron leer los datos.');
		return undefined;
	}
}
