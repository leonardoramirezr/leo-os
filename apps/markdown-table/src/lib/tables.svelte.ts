// The tables, as the account keeps them.
//
// A change is on screen first and in the database a moment later, so that typing in a cell goes
// out once per pause rather than once per key. Every write sends the whole row, which makes a table
// made offline and a table edited offline the same thing: an upsert. Until the database has a
// table's latest, the copy on the device says so, and the next time the app opens that copy is sent
// rather than read over — nothing typed is lost to a moment without signal.
import {
	eq,
	pull,
	push,
	readCache,
	remove,
	select,
	sync,
	upsert,
	writeCache,
	type MarkdownTableRow
} from '@leo-os/shared';
import { tableOf } from './edit';
import type { TableData } from './markdown';
import { DEFAULT_STYLE, sizeOf, styleOf, widthOf, type Sizes } from './styles';

export interface Table extends TableData {
	id: string;
	/** What the user named it; '' goes by its header. */
	title: string;
	/** Its image's look, by id (`styles.ts`). */
	style: string;
	/** Of its image's text, in CSS pixels; 0 goes by the style. */
	headerSize: number;
	bodySize: number;
	/** How wide its image's columns may get, in CSS pixels; 0 goes by the style. */
	columnWidth: number;
	/** Epoch milliseconds. */
	createdAt: number;
	editedAt: number;
}

const TABLE = 'markdown_tables';
const COLUMNS = 'id,title,cells,align,style,header_size,body_size,column_width,created_at,edited_at';

/** What this account's tables look like on the device, so the app opens without waiting. */
const CACHE = 'markdown-table:tables';

/**
 * Every app shares the few megabytes localStorage has: past this many characters the copy is not
 * kept, and the app waits for the database on opening.
 */
const CACHE_LIMIT = 1_500_000;

/** How long a change waits to be saved, in milliseconds, in case another one follows. */
const SAVE_DELAY = 800;

/** How long the header may run when it stands in for a name. */
const FALLBACK_LENGTH = 48;

/** The name a table goes by: the user's, else its header's cells. */
export function titleOf(table: Table): string {
	if (table.title.trim()) return table.title.trim();

	const header = table.cells[0]
		.map((cell) => cell.replace(/<br\s*\/?>/gi, ' ').replace(/[*_`~]/g, '').trim())
		.filter(Boolean)
		.join(' · ');
	if (!header) return 'Tabla sin título';
	return header.length > FALLBACK_LENGTH ? `${header.slice(0, FALLBACK_LENGTH - 1).trimEnd()}…` : header;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function time(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** A table from the cache, possibly an earlier version's, or from the database; `undefined` if it does not add up. */
function parseTable(raw: unknown): Table | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const item = raw as Record<string, unknown>;
	const id = text(item.id);
	const data = tableOf(item.cells, item.align);
	if (!id || !data) return undefined;

	return {
		id,
		title: text(item.title),
		...data,
		style: styleOf(text(item.style)).id,
		// Missing from an earlier version's copy: the style's own.
		headerSize: sizeOf(item.headerSize),
		bodySize: sizeOf(item.bodySize),
		columnWidth: widthOf(item.columnWidth),
		createdAt: time(item.createdAt),
		editedAt: time(item.editedAt)
	};
}

function parseTables(raw: unknown): Table[] {
	return (Array.isArray(raw) ? raw : []).flatMap((item) => parseTable(item) ?? []);
}

/** A row of the database, in the shape the app (and `parseTable`) works in. */
function tableOfRow(row: MarkdownTableRow) {
	return {
		id: row.id,
		title: row.title,
		cells: row.cells,
		align: row.align,
		style: row.style,
		headerSize: row.header_size,
		bodySize: row.body_size,
		columnWidth: row.column_width,
		createdAt: row.created_at,
		editedAt: row.edited_at
	};
}

function rowOf(userId: string, table: Table): MarkdownTableRow {
	return {
		id: table.id,
		user_id: userId,
		title: table.title,
		cells: table.cells,
		align: table.align,
		style: table.style,
		header_size: table.headerSize,
		body_size: table.bodySize,
		column_width: table.columnWidth,
		created_at: table.createdAt,
		edited_at: table.editedAt
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

interface Copy {
	tables: Table[];
	/** The ones whose latest the database does not have yet. */
	unsaved: string[];
}

class Tables {
	list = $state<Table[]>([]);

	/** The last edited first, which is where the one being worked on is. */
	sorted = $derived(this.list.toSorted((a, b) => b.editedAt - a.editedAt || b.createdAt - a.createdAt));

	/** The account everything on screen belongs to. Empty until `load` has run. */
	#account = '';

	/** Goes up with every change made here, so a read that crossed one knows it is out of date. */
	#version = 0;
	/** Per table, the same: a save that crossed a later change leaves it unsaved. */
	#changes = new Map<string, number>();

	/** Changed and not yet in the database, which the copy on the device remembers. */
	#unsaved = new Set<string>();
	/** Changed and not yet sent: what the timer is waiting for. */
	#dirty = new Set<string>();
	#timer: ReturnType<typeof setTimeout> | undefined;

	find(id: string | undefined): Table | undefined {
		return id ? this.list.find((table) => table.id === id) : undefined;
	}

	/**
	 * Reads this account's tables: first the copy on the device, so the app opens with something on
	 * screen, then what the database holds — after sending whatever the copy has that it does not.
	 * Never throws: with no connection the copy is what is left, and the banner says so.
	 */
	async load(userId: string) {
		this.#account = userId;
		const copy = readCache<Partial<Copy>>(CACHE, userId);
		this.list = parseTables(copy?.tables);
		const known = new Set(this.list.map((table) => table.id));
		this.#unsaved = new Set((Array.isArray(copy?.unsaved) ? copy.unsaved : []).filter((id) => known.has(id)));

		if (!this.#unsaved.size) return this.#read();
		// The copy is newer than the database: it opens as it is, and the database is read once it has
		// what the copy had. Read alongside, a write the database had yet to commit would come back as
		// the old row, and replace the edit on screen.
		const sends = [...this.#unsaved].map((id) => this.#send(id));
		Promise.all(sends).then(() => this.#read());
	}

	/** Back from the background: sends what did not make it, or reads again, in case another device changed something. */
	refresh() {
		if (!this.#account || this.#timer || sync.pending > 0) return;

		if (this.#unsaved.size) for (const id of this.#unsaved) this.#send(id);
		else this.#read();
	}

	/** Saves right away what is waiting to be: the app is going to the background, where it may be stopped. */
	flush() {
		if (!this.#timer) return;
		clearTimeout(this.#timer);
		this.#timer = undefined;

		this.#keep();
		for (const id of this.#dirty) this.#send(id);
		this.#dirty.clear();
	}

	/**
	 * A new table, saved at once. Unless told otherwise it takes the look of the last one edited,
	 * which is likely the one wanted. Gives back its id.
	 */
	add(
		data: TableData,
		title = '',
		style = this.sorted[0]?.style ?? DEFAULT_STYLE,
		sizes: Partial<Sizes> = {},
		columnWidth = 0
	): string {
		const now = Date.now();
		const id = newId();
		this.list.push({
			id,
			title: title.trim(),
			cells: data.cells,
			align: data.align,
			style,
			headerSize: sizeOf(sizes.header),
			bodySize: sizeOf(sizes.body),
			columnWidth: widthOf(columnWidth),
			createdAt: now,
			editedAt: now
		});
		this.#changed(id);
		this.#keep();
		this.#send(id);
		return id;
	}

	duplicate(id: string): string | undefined {
		const table = this.find(id);
		if (!table) return undefined;
		const { cells, align } = $state.snapshot(table);
		return this.add({ cells, align }, `${titleOf(table)} (copia)`, table.style, {
			header: table.headerSize,
			body: table.bodySize
		}, table.columnWidth);
	}

	/** New cells or alignments: an edit, typed or otherwise. */
	change(id: string, data: TableData) {
		this.#edit(id, (table) => {
			table.cells = data.cells;
			table.align = data.align;
		});
	}

	rename(id: string, title: string) {
		this.#edit(id, (table) => (table.title = title.trim()));
	}

	restyle(id: string, style: string) {
		this.#edit(id, (table) => (table.style = styleOf(style).id));
	}

	/** The size of the image's header or body text; 0 goes back to the style's. */
	resize(id: string, part: keyof Sizes, size: number) {
		this.#edit(id, (table) => {
			if (part === 'header') table.headerSize = sizeOf(size);
			else table.bodySize = sizeOf(size);
		});
	}

	/** How wide the image's columns may get; 0 goes back to the style's. */
	widen(id: string, width: number) {
		this.#edit(id, (table) => (table.columnWidth = widthOf(width)));
	}

	remove(id: string) {
		this.list = this.list.filter((table) => table.id !== id);
		this.#unsaved.delete(id);
		this.#dirty.delete(id);
		this.#changes.delete(id);
		this.#version++;
		this.#keep();
		push(
			() => remove(TABLE, eq('id', id)),
			() => this.#read()
		);
	}

	#edit(id: string, apply: (table: Table) => void) {
		const table = this.find(id);
		if (!table) return;

		apply(table);
		table.editedAt = Date.now();
		this.#changed(id);
		this.#dirty.add(id);
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => this.flush(), SAVE_DELAY);
	}

	#changed(id: string) {
		this.#version++;
		this.#changes.set(id, (this.#changes.get(id) ?? 0) + 1);
		this.#unsaved.add(id);
	}

	/** Settles once the database has answered, either way. */
	#send(id: string): Promise<void> {
		const table = this.find(id);
		if (!table) return Promise.resolve();

		const row = rowOf(this.#account, $state.snapshot(table));
		const changes = this.#changes.get(id) ?? 0;
		return push(
			async () => {
				await upsert(TABLE, row);
				// Saved, unless it changed again on the way: that change has a save of its own coming.
				if ((this.#changes.get(id) ?? 0) === changes && this.#unsaved.delete(id)) this.#keep();
			},
			// Refused, or no connection: it stays on screen and on the device, marked as not saved,
			// and goes out with the next change, when the app comes back, or the next time it opens.
			// Reading the database again would put back what it had before.
			() => {}
		);
	}

	/** Puts on screen what the database holds, but for what is still to be saved here. */
	async #read() {
		const version = this.#version;
		const rows = await pull(() => select<MarkdownTableRow>(TABLE, COLUMNS));
		// A change made while the rows were on their way is not in them: its own save settles it.
		if (!rows || version !== this.#version) return;

		const theirs = parseTables(rows.map(tableOfRow)).filter((table) => !this.#unsaved.has(table.id));
		const mine = this.list.filter((table) => this.#unsaved.has(table.id));
		this.list = [...theirs, ...mine];
		this.#keep();
	}

	#keep() {
		if (!this.#account) return;
		const copy: Copy = { tables: $state.snapshot(this.list), unsaved: [...this.#unsaved] };
		writeCache(CACHE, this.#account, copy, CACHE_LIMIT);
	}
}

export const tables = new Tables();
