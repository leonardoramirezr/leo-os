// Undo and redo for the table being edited. It lives as long as the table stays open: what it keeps
// is what the table was before each change, and taking a row or a column out by mistake is what it
// is there for.
import type { TableData } from './markdown';

/** How far back undo goes. */
const STEPS = 100;

/** Typing counts as a single change until it pauses this long, in milliseconds. */
const TYPING_PAUSE = 1500;

export class History {
	#past = $state.raw<TableData[]>([]);
	#future = $state.raw<TableData[]>([]);

	/** What the last change was to, `cell:2:3` for one cell: more typing there is the same change. */
	#last = '';
	#lastAt = 0;

	canUndo = $derived(this.#past.length > 0);
	canRedo = $derived(this.#future.length > 0);

	/**
	 * Before a change: `before` gives the table as it is now, asked for only when it is kept. Changes
	 * to the same `key` made without a pause are one, and undo takes them back together.
	 */
	record(before: () => TableData, key = '') {
		const now = Date.now();
		const same = key !== '' && key === this.#last && now - this.#lastAt < TYPING_PAUSE;
		this.#last = key;
		this.#lastAt = now;
		if (same) return;

		this.#past = [...this.#past, before()].slice(-STEPS);
		this.#future = [];
	}

	/** The table as it was before the last change; `current` is kept for redo. */
	undo(current: TableData): TableData | undefined {
		const before = this.#past.at(-1);
		if (!before) return undefined;
		this.#past = this.#past.slice(0, -1);
		this.#future = [...this.#future, current];
		this.#last = '';
		return before;
	}

	redo(current: TableData): TableData | undefined {
		const after = this.#future.at(-1);
		if (!after) return undefined;
		this.#future = this.#future.slice(0, -1);
		this.#past = [...this.#past, current];
		this.#last = '';
		return after;
	}

	/** Another table: nothing of this one's to undo there. */
	reset() {
		this.#past = [];
		this.#future = [];
		this.#last = '';
	}
}
