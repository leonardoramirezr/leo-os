// The templates, and the answers given to them.
//
// A change is on screen first and in the database right after, like everywhere else here. The
// answers are not kept: they are about the prompt being put together now, and stay only while the
// app is open, so that going back to the list and in again does not lose them.
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
	type PlantillasTemplateRow
} from '@leo-os/shared';
import { shorten } from './template';

export interface Template {
	id: string;
	/** What the user named it; '' goes by the first words of the body. */
	title: string;
	/** Plain text with a `[[[question]]]` wherever there is a blank. */
	body: string;
	/** Epoch milliseconds. */
	createdAt: number;
}

const TABLE = 'plantillas_templates';
const COLUMNS = 'id,title,body,created_at';

/** What this account's templates look like on the device, so the app opens without waiting. */
const CACHE = 'plantillas:templates';

/** How long the first words of the body may run when they stand in for a name. */
const FALLBACK_LENGTH = 40;

/** Alphabetical the way a person reads it: «b» next to «B», «Plantilla 2» before «Plantilla 10». */
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** The name a template goes by: the user's, else the first words of its body, blanks and all. */
export function titleOf(template: Template): string {
	if (template.title.trim()) return template.title.trim();

	const line = template.body
		.replace(/\[\[\[([\s\S]*?)\]\]\]/g, '$1')
		.trim()
		.split('\n')[0]
		.replace(/\s+/g, ' ');
	const words = shorten(line.replace(/[.:;,]+$/, ''), FALLBACK_LENGTH);
	return words ? words[0].toUpperCase() + words.slice(1) : 'Sin título';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

/** Rows may come from the cache of an earlier version: anything that does not add up is dropped. */
function parse(raw: unknown): Template[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = text(item.id);
		const body = text(item.body);
		if (!id || !body.trim()) return [];

		const createdAt = typeof item.createdAt === 'number' ? item.createdAt : 0;
		return [{ id, title: text(item.title), body, createdAt }];
	});
}

/** A row of the database, in the shape the app (and `parse`) works in. */
function templateOf(row: PlantillasTemplateRow) {
	return { id: row.id, title: row.title, body: row.body, createdAt: row.created_at };
}

function rowOf(userId: string, template: Template): PlantillasTemplateRow {
	return {
		id: template.id,
		user_id: userId,
		title: template.title,
		body: template.body,
		created_at: template.createdAt
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

class Templates {
	list = $state<Template[]>([]);

	/** In alphabetical order of the names they go by, which is how the first screen lists them. */
	sorted = $derived(
		this.list.toSorted((a, b) => collator.compare(titleOf(a), titleOf(b)) || a.createdAt - b.createdAt)
	);

	/** The answers given so far, by template and then by question. Never saved. */
	answers = $state<Record<string, Record<string, string>>>({});

	/** The account everything on screen belongs to. Empty until `load` has run. */
	#account = '';

	/** Goes up with every change made here, so a read that crossed one knows it is out of date. */
	#version = 0;

	find(id: string | undefined): Template | undefined {
		return id ? this.list.find((template) => template.id === id) : undefined;
	}

	/** The answers given to a template so far, by question. */
	answersTo(id: string): Record<string, string> {
		return this.answers[id] ?? {};
	}

	answer(id: string, question: string, value: string) {
		this.answers[id] = { ...this.answers[id], [question]: value };
	}

	/** Empties a template's answers, for the next prompt made out of it. */
	clearAnswers(id: string) {
		delete this.answers[id];
	}

	/**
	 * Reads this account's templates: first what the device remembers of them, so the app opens with
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

	add(title: string, body: string): Template {
		const template: Template = { id: newId(), title: title.trim(), body: body.trim(), createdAt: Date.now() };
		this.list.push(template);
		const userId = this.#account;
		this.#push(() => insert(TABLE, rowOf(userId, template)));
		return template;
	}

	update(id: string, title: string, body: string) {
		const template = this.find(id);
		if (!template) return;

		template.title = title.trim();
		template.body = body.trim();
		this.#push(() => update(TABLE, eq('id', id), { title: template.title, body: template.body }));
	}

	remove(id: string) {
		this.list = this.list.filter((template) => template.id !== id);
		delete this.answers[id];
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
		const rows = await pull(() => select<PlantillasTemplateRow>(TABLE, COLUMNS));
		// A change made while the rows were on their way is not in them: its own write settles it.
		if (!rows || version !== this.#version) return;

		this.list = parse(rows.map(templateOf));
		this.#keep();
	}

	#keep() {
		if (this.#account) writeCache(CACHE, this.#account, $state.snapshot(this.list));
	}
}

export const templates = new Templates();
