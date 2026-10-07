// The routines: their days and the exercises of each, edited as a whole and saved as one row.
//
// A change is on screen first and in the database right after, like everywhere else here; if the
// database refuses it, the routines are read again so that what is on screen is what was saved.
import {
	eq,
	insert,
	pull,
	push,
	readCache,
	remove,
	select,
	sync,
	update,
	writeCache,
	type RutinaDay,
	type RutinaRoutineRow
} from '@leo-os/shared';
import { newId } from './ids';
import { parseDays, type Routine } from './routine';

const TABLE = 'rutina_routines';
const COLUMNS = 'id,name,days,created_at';

/** What this account's routines look like on the device, so the app opens without waiting. */
const CACHE = 'rutina:routines';

/** Alphabetical the way a person reads it: «b» next to «B», «Rutina 2» before «Rutina 10». */
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Rows may come from the cache of an earlier version: anything that does not add up is dropped. */
function parse(raw: unknown): Routine[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = typeof item.id === 'string' ? item.id : '';
		if (!id) return [];
		return [
			{
				id,
				name: typeof item.name === 'string' ? item.name : '',
				days: parseDays(item.days),
				createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0
			}
		];
	});
}

function routineOf(row: RutinaRoutineRow) {
	return { id: row.id, name: row.name, days: row.days, createdAt: row.created_at };
}

class Routines {
	list = $state<Routine[]>([]);

	sorted = $derived(
		this.list.toSorted((a, b) => collator.compare(a.name, b.name) || a.createdAt - b.createdAt)
	);

	/** The account everything on screen belongs to. Empty until `load` has run. */
	#account = '';

	/** Goes up with every change made here, so a read that crossed one knows it is out of date. */
	#version = 0;

	find(id: string | undefined): Routine | undefined {
		return id ? this.list.find((routine) => routine.id === id) : undefined;
	}

	/**
	 * Reads this account's routines: first what the device remembers of them, so the app opens with
	 * something on screen, then what the database holds. Never throws.
	 */
	async load(userId: string) {
		this.#account = userId;
		this.list = parse(readCache(CACHE, userId));
		await this.#read();
	}

	/** Reads them again, e.g. back from the background: they may have changed on another device. */
	refresh() {
		// A change still on its way is not in what the database would answer.
		if (this.#account && sync.pending === 0) this.#read();
	}

	add(name: string, days: RutinaDay[]): Routine {
		const routine: Routine = { id: newId(), name: name.trim(), days, createdAt: Date.now() };
		this.list.push(routine);
		const row = { id: routine.id, name: routine.name, days, created_at: routine.createdAt };
		this.#push(() => insert(TABLE, row));
		return routine;
	}

	save(id: string, name: string, days: RutinaDay[]) {
		const routine = this.find(id);
		if (!routine) return;

		routine.name = name.trim();
		routine.days = days;
		this.#push(() => update(TABLE, eq('id', id), { name: routine.name, days }));
	}

	/** Takes its sessions along: the database cascades, and `sessions` drops its copy. */
	remove(id: string) {
		this.list = this.list.filter((routine) => routine.id !== id);
		this.#push(() => remove(TABLE, eq('id', id)));
	}

	#push(run: () => Promise<void>) {
		this.#version++;
		this.#keep();
		push(run, () => this.#read());
	}

	/** Puts on screen exactly what the database holds. With no connection, what is there stays. */
	async #read() {
		const version = this.#version;
		const rows = await pull(() => select<RutinaRoutineRow>(TABLE, COLUMNS));
		// A change made while the rows were on their way is not in them: its own write settles it.
		if (!rows || version !== this.#version) return;

		this.list = parse(rows.map(routineOf));
		this.#keep();
	}

	#keep() {
		if (this.#account) writeCache(CACHE, this.#account, $state.snapshot(this.list));
	}
}

export const routines = new Routines();
