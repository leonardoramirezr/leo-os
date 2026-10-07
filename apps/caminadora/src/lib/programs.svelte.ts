// The training programs: segments one after another, each with how long it lasts and how fast the
// treadmill goes meanwhile.
//
// A change is on screen first and in the database right after, like everywhere else here.
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
	type CaminadoraProgramRow,
	type CaminadoraSegment
} from '@leo-os/shared';

export type Segment = CaminadoraSegment;

export interface Program {
	id: string;
	name: string;
	/** In the order they run. Never empty. */
	segments: Segment[];
	/** Epoch milliseconds. */
	createdAt: number;
}

/** The fastest a segment may go, in km/h: past it is a typo, caught before the program is saved. */
export const MAX_SPEED = 30;

const TABLE = 'caminadora_programs';
const COLUMNS = 'id,name,segments,created_at';

/** What this account's programs look like on the device, so the app opens without waiting. */
const CACHE = 'caminadora:programs';

/** Alphabetical the way a person reads it: «b» next to «B», «Programa 2» before «Programa 10». */
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** Seconds a program lasts. */
export function lengthOf(segments: Segment[]): number {
	return segments.reduce((sum, segment) => sum + segment.seconds, 0);
}

/**
 * The segment a second of the program falls in, and the second that segment started at. Past the
 * end it is still the last one, which is where a finished program stays.
 */
export function segmentAt(segments: Segment[], second: number): { index: number; start: number } {
	let start = 0;
	for (let index = 0; index < segments.length; index++) {
		const end = start + segments[index].seconds;
		if (second < end) return { index, start };
		start = end;
	}
	const last = segments.length - 1;
	return { index: last, start: start - (segments[last]?.seconds ?? 0) };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/** Segments as they come from the database or the device: whatever does not add up is dropped. */
export function parseSegments(raw: unknown): Segment[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const seconds = Number.isFinite(item.seconds) ? Math.round(item.seconds as number) : 0;
		const speed = Number.isFinite(item.speed) ? Math.round((item.speed as number) * 10) / 10 : 0;
		return seconds > 0 && speed > 0 ? [{ seconds, speed }] : [];
	});
}

/** Rows may come from the cache of an earlier version: anything that does not add up is dropped. */
function parse(raw: unknown): Program[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = typeof item.id === 'string' ? item.id : '';
		const segments = parseSegments(item.segments);
		if (!id || !segments.length) return [];

		const name = typeof item.name === 'string' ? item.name : '';
		const createdAt = typeof item.createdAt === 'number' ? item.createdAt : 0;
		return [{ id, name, segments, createdAt }];
	});
}

/** A row of the database, in the shape the app (and `parse`) works in. */
function programOf(row: CaminadoraProgramRow) {
	return { id: row.id, name: row.name, segments: row.segments, createdAt: row.created_at };
}

function rowOf(userId: string, program: Program): CaminadoraProgramRow {
	return {
		id: program.id,
		user_id: userId,
		name: program.name,
		segments: program.segments,
		created_at: program.createdAt
	};
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

class Programs {
	list = $state<Program[]>([]);

	/** In alphabetical order of their names, which is how the first screen lists them. */
	sorted = $derived(
		this.list.toSorted((a, b) => collator.compare(a.name, b.name) || a.createdAt - b.createdAt)
	);

	/** The account everything on screen belongs to. Empty until `load` has run. */
	#account = '';

	/** Goes up with every change made here, so a read that crossed one knows it is out of date. */
	#version = 0;

	find(id: string | undefined): Program | undefined {
		return id ? this.list.find((program) => program.id === id) : undefined;
	}

	/**
	 * Reads this account's programs: first what the device remembers of them, so the app opens with
	 * something on screen, then what the database holds. Never throws — with no connection the
	 * cached ones are what is left, and the banner says so.
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

	/** What a program left unnamed is called: the first «Programa N» not taken yet. */
	nextName(): string {
		const taken = new Set(this.list.map((program) => program.name));
		let number = this.list.length + 1;
		while (taken.has(`Programa ${number}`)) number++;
		return `Programa ${number}`;
	}

	add(name: string, segments: Segment[]): Program {
		const program: Program = {
			id: newId(),
			name: name.trim() || this.nextName(),
			segments,
			createdAt: Date.now()
		};
		this.list.push(program);
		const userId = this.#account;
		this.#push(() => insert(TABLE, rowOf(userId, program)));
		return program;
	}

	/** A name left empty keeps the one it had. */
	update(id: string, name: string, segments: Segment[]) {
		const program = this.find(id);
		if (!program) return;

		program.name = name.trim() || program.name;
		program.segments = segments;
		const columns = { name: program.name, segments };
		this.#push(() => update(TABLE, eq('id', id), columns));
	}

	remove(id: string) {
		this.list = this.list.filter((program) => program.id !== id);
		this.#push(() => remove(TABLE, eq('id', id)));
	}

	/**
	 * Sends a change already applied on screen. If the database refuses it, everything is read again
	 * so that what is on screen is what was saved.
	 *
	 * With no connection there is nothing to read either: the change stays on screen and the banner
	 * says it is not saved, which beats throwing it away over a moment without signal.
	 */
	#push(run: () => Promise<void>) {
		this.#version++;
		this.#keep();
		push(run, () => this.#read());
	}

	/** Puts on screen exactly what the database holds. With no connection, what is there stays. */
	async #read() {
		const version = this.#version;
		const rows = await pull(() => select<CaminadoraProgramRow>(TABLE, COLUMNS));
		// A change made while the rows were on their way is not in them: its own write settles it.
		if (!rows || version !== this.#version) return;

		this.list = parse(rows.map(programOf));
		this.#keep();
	}

	#keep() {
		if (this.#account) writeCache(CACHE, this.#account, $state.snapshot(this.list));
	}
}

export const programs = new Programs();
