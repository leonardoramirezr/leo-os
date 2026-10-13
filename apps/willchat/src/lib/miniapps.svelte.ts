// The mini apps: prompts that ask before they are sent, each run for one result. What they are lives
// in the account, like WillChat's settings; what was answered and what came back stay on the device
// (`runs.svelte.ts`), as the conversation does.
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
	type WillchatMiniAppInput,
	type WillchatMiniAppRow
} from '@leo-os/shared';

export type MiniAppInput = WillchatMiniAppInput;

export interface MiniApp {
	id: string;
	name: string;
	/** With a `[[[question]]]` wherever the user is asked something. */
	prompt: string;
	/** The files and images it asks for, after the questions. */
	inputs: MiniAppInput[];
	/** Epoch milliseconds. */
	createdAt: number;
}

const TABLE = 'willchat_mini_apps';
const COLUMNS = 'id,name,prompt,inputs,created_at';

/** What this account's mini apps look like on the device, so the app opens without waiting. */
const CACHE = 'willchat:mini-apps';

/** A question: anything between three brackets on each side, on one line. */
const QUESTION = /\[\[\[([^[\]\n]+)\]\]\]/g;

/** The questions a prompt asks, in order. The same question asked twice is one field. */
export function questionsOf(prompt: string): string[] {
	const questions = [...prompt.matchAll(QUESTION)].map((match) => match[1].trim()).filter(Boolean);
	return [...new Set(questions)];
}

/** The prompt with every answer written right under the question it answers. */
export function fill(prompt: string, answers: Record<string, string>): string {
	return prompt.replace(QUESTION, (question, text: string) => {
		const answer = answers[text.trim()]?.trim();
		return answer ? `${question}\n${answer}` : question;
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function parseInputs(raw: unknown): MiniAppInput[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = typeof item.id === 'string' ? item.id : '';
		const kind = item.kind === 'image' || item.kind === 'file' ? item.kind : undefined;
		const title = typeof item.title === 'string' ? item.title : '';
		return id && kind ? [{ id, kind, title }] : [];
	});
}

/** Rows may come from the cache of an earlier version: anything that does not add up is dropped. */
function parse(raw: unknown): MiniApp[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = typeof item.id === 'string' ? item.id : '';
		if (!id) return [];

		return [
			{
				id,
				name: typeof item.name === 'string' ? item.name : '',
				prompt: typeof item.prompt === 'string' ? item.prompt : '',
				inputs: parseInputs(item.inputs),
				createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0
			}
		];
	});
}

/** A row of the database, in the shape the app (and `parse`) works in. */
function miniAppOf(row: WillchatMiniAppRow) {
	return { id: row.id, name: row.name, prompt: row.prompt, inputs: row.inputs, createdAt: row.created_at };
}

function rowOf(userId: string, app: MiniApp): WillchatMiniAppRow {
	return {
		id: app.id,
		user_id: userId,
		name: app.name,
		prompt: app.prompt,
		inputs: app.inputs,
		created_at: app.createdAt
	};
}

/** The `uuid` the table is keyed by. */
export function newId(): string {
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

export interface MiniAppDraft {
	name: string;
	prompt: string;
	inputs: MiniAppInput[];
}

class MiniApps {
	list = $state<MiniApp[]>([]);

	/** Newest first, which is how the list shows them. */
	sorted = $derived(this.list.toSorted((a, b) => b.createdAt - a.createdAt));

	/** The account everything on screen belongs to. Empty until `load` has run. */
	#account = '';

	/** Goes up with every change made here, so a read that crossed one knows it is out of date. */
	#version = 0;

	find(id: string | undefined): MiniApp | undefined {
		return id ? this.list.find((app) => app.id === id) : undefined;
	}

	/**
	 * Reads this account's mini apps: first what the device remembers of them, then what the
	 * database holds. Never throws — with no connection the cached ones are what is left.
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

	add(draft: MiniAppDraft): MiniApp {
		const app: MiniApp = { id: newId(), ...draft, createdAt: Date.now() };
		this.list.push(app);
		const userId = this.#account;
		this.#push(() => insert(TABLE, rowOf(userId, app)));
		return app;
	}

	update(id: string, draft: MiniAppDraft) {
		const app = this.find(id);
		if (!app) return;

		Object.assign(app, draft);
		const columns = { ...draft };
		this.#push(() => update(TABLE, eq('id', id), columns));
	}

	remove(id: string) {
		this.list = this.list.filter((app) => app.id !== id);
		this.#push(() => remove(TABLE, eq('id', id)));
	}

	/**
	 * Sends a change already applied on screen. If the database refuses it, everything is read again
	 * so that what is on screen is what was saved.
	 */
	#push(run: () => Promise<void>) {
		this.#version++;
		this.#keep();
		push(run, () => this.#read());
	}

	/** Puts on screen exactly what the database holds. With no connection, what is there stays. */
	async #read() {
		const version = this.#version;
		const rows = await pull(() => select<WillchatMiniAppRow>(TABLE, COLUMNS));
		// A change made while the rows were on their way is not in them: its own write settles it.
		if (!rows || version !== this.#version) return;

		this.list = parse(rows.map(miniAppOf));
		this.#keep();
	}

	#keep() {
		if (this.#account) writeCache(CACHE, this.#account, $state.snapshot(this.list));
	}
}

export const miniApps = new MiniApps();
