import {
	oneOf,
	pull,
	push,
	readCache,
	remove,
	select,
	sync,
	upsert,
	writeCache,
	type ListItemRow
} from '@leo-os/shared';

export interface Item {
	id: string;
	text: string;
	done: boolean;
	/** Smallest first. Gaps are fine: removing an item leaves the others where they were. */
	position: number;
}

/** What a voice command does to the list, pointing at items by id. */
export type Change =
	| { op: 'add'; text: string }
	| { op: 'edit'; id: string; text: string }
	| { op: 'remove'; id: string }
	| { op: 'check'; id: string; done: boolean }
	| { op: 'clear' };

const TABLE = 'lista_items';

/** What this account's list looks like on the device, so the app opens without waiting. */
const CACHE = 'lista';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Rows may come from the cache of an earlier version: anything that does not add up is dropped. */
function parseItems(raw: unknown): Item[] {
	if (!Array.isArray(raw)) return [];

	return raw
		.filter(isRecord)
		.flatMap((item) => {
			const id = typeof item.id === 'string' ? item.id : '';
			const text = typeof item.text === 'string' ? item.text.trim() : '';
			if (!id || !text) return [];

			const position = typeof item.position === 'number' ? item.position : 0;
			return [{ id, text, done: item.done === true, position }];
		})
		.sort(byPosition);
}

function byPosition(a: Item, b: Item): number {
	return a.position - b.position || a.id.localeCompare(b.id);
}

function rowOf(userId: string, item: Item): ListItemRow {
	return { id: item.id, user_id: userId, text: item.text, done: item.done, position: item.position };
}

/** Where an item added now goes: after every other. */
function nextPosition(items: Item[]): number {
	return items.reduce((last, item) => Math.max(last, item.position), 0) + 1;
}

/** The `uuid` the table is keyed by. */
function newId(): string {
	const crypto = globalThis.crypto;
	if (crypto?.randomUUID) return crypto.randomUUID();

	// Safari only offers randomUUID over HTTPS. Same shape, drawn by hand.
	const bytes = new Uint8Array(16);
	if (crypto?.getRandomValues) crypto.getRandomValues(bytes);
	else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** What going from `before` to `after` takes: the ids that go away, and the items that are new or changed. */
function diff(before: Item[], after: Item[]) {
	const was = new Map(before.map((item) => [item.id, item]));
	const kept = new Set(after.map((item) => item.id));

	return {
		removed: before.filter((item) => !kept.has(item.id)).map((item) => item.id),
		written: after.filter((item) => {
			const old = was.get(item.id);
			return !old || old.text !== item.text || old.done !== item.done || old.position !== item.position;
		})
	};
}

/** The items `after` has that are new, or whose text is not what it was in `before`. */
function rewritten(before: Item[], after: Item[]): string[] {
	const texts = new Map(before.map((item) => [item.id, item.text]));
	return after.filter((item) => texts.get(item.id) !== item.text).map((item) => item.id);
}

/**
 * `now` with the step from `before` to `after` taken back: what it added goes, what it removed comes
 * back where it was, and what it rewrote or ticked returns to how it was. Whatever changed since by
 * other means — a box ticked by hand, say — stays as it is.
 */
function revert(now: Item[], before: Item[], after: Item[]): Item[] {
	const was = new Map(before.map((item) => [item.id, item]));
	const became = new Map(after.map((item) => [item.id, item]));

	const reverted = now.flatMap((item) => {
		const old = was.get(item.id);
		const changed = became.get(item.id);
		// Added by that step: it goes.
		if (!old && changed) return [];
		// Not that step's doing, or back since from somewhere else: it stays as it is.
		if (!old || !changed) return [item];

		return [
			{
				...item,
				text: changed.text !== old.text ? old.text : item.text,
				done: changed.done !== old.done ? old.done : item.done
			}
		];
	});

	const present = new Set(reverted.map((item) => item.id));
	for (const old of before) {
		if (!became.has(old.id) && !present.has(old.id)) reverted.push(old);
	}
	return reverted.sort(byPosition);
}

class List {
	/** In the order they are shown, which is also how the model numbers them. */
	items = $state<Item[]>([]);

	/** What the last voice command, or taking it back, added or rewrote: the screen points them out. */
	recent = $state<string[]>([]);

	/** The last voice command, kept to take it back. */
	#last = $state.raw<{ before: Item[]; after: Item[] }>();

	/** The account everything on screen belongs to. Empty until `load` has run. */
	#account = '';

	/** Goes up with every change made here, so a read that crossed one knows it is out of date. */
	#version = 0;

	get canUndo(): boolean {
		return this.#last !== undefined;
	}

	/**
	 * Reads this account's list: first what the device remembers of it, so the app opens with
	 * something on screen, then what the database holds. Never throws — with no connection the
	 * cached list is what is left, and the banner says so.
	 */
	async load(userId: string) {
		this.#account = userId;
		this.items = parseItems(readCache(CACHE, userId));
		await this.#read();
	}

	/** Reads the list again, e.g. back from the background: another device may have changed it. */
	refresh() {
		// A change still on its way is not in what the database would answer.
		if (this.#account && sync.pending === 0) this.#read();
	}

	toggle(id: string) {
		this.#commit(this.#snapshot().map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
	}

	/** Applies what a voice command decided. Says whether the list changed at all. */
	apply(changes: Change[]): boolean {
		const before = this.#snapshot();
		let after = before.map((item) => ({ ...item }));

		for (const change of changes) {
			if (change.op === 'clear') {
				after = [];
			} else if (change.op === 'add') {
				after.push({ id: newId(), text: change.text, done: false, position: nextPosition(after) });
			} else if (change.op === 'remove') {
				after = after.filter((item) => item.id !== change.id);
			} else {
				const item = after.find((candidate) => candidate.id === change.id);
				if (!item) continue;
				if (change.op === 'edit') item.text = change.text;
				else item.done = change.done;
			}
		}

		const { removed, written } = diff(before, after);
		if (!removed.length && !written.length) return false;

		this.recent = rewritten(before, after);
		this.#last = { before, after };
		this.#commit(after);
		return true;
	}

	/** Takes back the last voice command. Says whether there was one to take back. */
	undo(): boolean {
		const last = this.#last;
		if (!last) return false;

		const now = this.#snapshot();
		const reverted = revert(now, last.before, last.after);
		this.#last = undefined;
		this.recent = rewritten(now, reverted);
		this.#commit(reverted);
		return true;
	}

	#snapshot(): Item[] {
		return $state.snapshot(this.items);
	}

	/**
	 * Puts `next` on screen and sends only what differs from what was there: one request for what
	 * went away, one for what is new or changed. If the database refuses, the list is read again so
	 * that what is on screen is what was saved.
	 *
	 * With no connection there is nothing to read either: the change stays on screen and the banner
	 * says it is not saved, which beats throwing it away over a moment without signal.
	 */
	#commit(next: Item[]) {
		const { removed, written } = diff(this.#snapshot(), next);
		this.items = next.toSorted(byPosition);
		this.#version++;
		this.#save();
		if (!removed.length && !written.length) return;

		const userId = this.#account;
		push(
			async () => {
				if (removed.length) await remove(TABLE, oneOf('id', removed));
				if (written.length) await upsert(TABLE, written.map((item) => rowOf(userId, item)));
			},
			() => this.#read()
		);
	}

	/** Puts on screen exactly what the database holds. With no connection, what is there stays. */
	async #read() {
		const version = this.#version;
		const rows = await pull(() => select<ListItemRow>(TABLE, 'id,text,done,position'));
		// A change made while the rows were on their way is not in them: its own write settles it.
		if (!rows || version !== this.#version) return;

		this.items = parseItems(rows);
		this.#save();
	}

	#save() {
		if (this.#account) writeCache(CACHE, this.#account, this.#snapshot());
	}
}

export const list = new List();
