// The prompts: what each one turns a text into, in the user's words, and the name it goes by.
//
// A change is on screen first and in the database right after, like everywhere else here. A
// prompt left without a name is given one by the chat model, out of its instructions; until then,
// or if that does not work out, the first words of the instructions stand in for it.
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
	type TransformaPromptRow
} from '@leo-os/shared';
import { apiKey, model } from './settings.svelte';
import { shorten, title as titleFor } from './transform';

export interface Prompt {
	id: string;
	/** What the user named it; '' leaves the name to the app. */
	title: string;
	/** The name the chat model gave it, for as long as `title` is empty. */
	autoTitle: string;
	/** What a text is to become, in the user's words. */
	instructions: string;
	/** Epoch milliseconds. */
	createdAt: number;
}

const TABLE = 'transforma_prompts';
const COLUMNS = 'id,title,auto_title,instructions,created_at';

/** What this account's prompts look like on the device, so the app opens without waiting. */
const CACHE = 'transforma:prompts';

/** How long the first words of the instructions may run when they stand in for a name. */
const FALLBACK_LENGTH = 40;

/** Alphabetical the way a person reads it: «b» next to «B», «Prompt 2» before «Prompt 10». */
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/** The name a prompt goes by: the user's, else the one the app gave it, else its first words. */
export function titleOf(prompt: Prompt): string {
	if (prompt.title.trim()) return prompt.title.trim();
	if (prompt.autoTitle.trim()) return prompt.autoTitle.trim();

	const line = prompt.instructions.trim().split('\n')[0].replace(/\s+/g, ' ');
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
function parse(raw: unknown): Prompt[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = text(item.id);
		const instructions = text(item.instructions);
		if (!id || !instructions.trim()) return [];

		const createdAt = typeof item.createdAt === 'number' ? item.createdAt : 0;
		return [{ id, title: text(item.title), autoTitle: text(item.autoTitle), instructions, createdAt }];
	});
}

/** A row of the database, in the shape the app (and `parse`) works in. */
function promptOf(row: TransformaPromptRow) {
	return {
		id: row.id,
		title: row.title,
		autoTitle: row.auto_title,
		instructions: row.instructions,
		createdAt: row.created_at
	};
}

function rowOf(userId: string, prompt: Prompt): TransformaPromptRow {
	return {
		id: prompt.id,
		user_id: userId,
		title: prompt.title,
		auto_title: prompt.autoTitle,
		instructions: prompt.instructions,
		created_at: prompt.createdAt
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

class Prompts {
	list = $state<Prompt[]>([]);

	/** In alphabetical order of the names they go by, which is how the first screen lists them. */
	sorted = $derived(
		this.list.toSorted(
			(a, b) => collator.compare(titleOf(a), titleOf(b)) || a.createdAt - b.createdAt
		)
	);

	/** The account everything on screen belongs to. Empty until `load` has run. */
	#account = '';

	/** Goes up with every change made here, so a read that crossed one knows it is out of date. */
	#version = 0;

	/** The prompts being named right now, so that none is asked about twice at once. */
	#naming = new Set<string>();

	find(id: string | undefined): Prompt | undefined {
		return id ? this.list.find((prompt) => prompt.id === id) : undefined;
	}

	/**
	 * Reads this account's prompts: first what the device remembers of them, so the app opens with
	 * something on screen, then what the database holds. Never throws — with no connection the
	 * cached ones are what is left, and the banner says so.
	 */
	async load(userId: string) {
		this.#account = userId;
		this.list = parse(readCache(CACHE, userId));
		await this.#read();

		// Prompts a request left unnamed — no connection, say — are tried again on every visit.
		void this.#nameAll();
	}

	/** Reads them again, e.g. back from the background: they may have changed on another device. */
	refresh() {
		// A change still on its way is not in what the database would answer.
		if (this.#account && sync.pending === 0) this.#read();
	}

	add(title: string, instructions: string): Prompt {
		const prompt: Prompt = {
			id: newId(),
			title: title.trim(),
			autoTitle: '',
			instructions: instructions.trim(),
			createdAt: Date.now()
		};
		this.list.push(prompt);
		const userId = this.#account;
		this.#push(() => insert(TABLE, rowOf(userId, prompt)));
		if (!prompt.title) void this.#name(prompt.id);
		return prompt;
	}

	update(id: string, title: string, instructions: string) {
		const prompt = this.find(id);
		if (!prompt) return;

		const rewritten = prompt.instructions !== instructions.trim();
		prompt.title = title.trim();
		prompt.instructions = instructions.trim();
		// The name the app gave it said what the old instructions did.
		if (rewritten) prompt.autoTitle = '';

		const columns = {
			title: prompt.title,
			auto_title: prompt.autoTitle,
			instructions: prompt.instructions
		};
		this.#push(() => update(TABLE, eq('id', id), columns));
		if (!prompt.title && !prompt.autoTitle) void this.#name(id);
	}

	remove(id: string) {
		this.list = this.list.filter((prompt) => prompt.id !== id);
		this.#push(() => remove(TABLE, eq('id', id)));
	}

	/** Names, one at a time, every prompt that goes by the first words of its instructions. */
	async #nameAll() {
		const unnamed = this.list.filter((prompt) => !prompt.title && !prompt.autoTitle);
		for (const prompt of unnamed) await this.#name(prompt.id);
	}

	/**
	 * Asks the chat model for a name for the prompt. Quietly: when it does not work out, the first
	 * words of the instructions go on standing in, and the next visit asks again.
	 */
	async #name(id: string) {
		if (this.#naming.has(id)) return;
		this.#naming.add(id);

		try {
			for (;;) {
				const prompt = this.find(id);
				if (!prompt || prompt.title || prompt.autoTitle || !apiKey.value) return;

				const instructions = prompt.instructions;
				const name = await titleFor(apiKey.value, model.value, instructions).catch(() => '');
				const named = this.find(id);
				if (!name || !named || named.title) return;
				// Rewritten while the model was at it: the name is asked for again, for what it says now.
				if (named.instructions !== instructions) continue;

				named.autoTitle = name;
				this.#push(() => update(TABLE, eq('id', id), { auto_title: name }));
				return;
			}
		} finally {
			this.#naming.delete(id);
		}
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
		const rows = await pull(() => select<TransformaPromptRow>(TABLE, COLUMNS));
		// A change made while the rows were on their way is not in them: its own write settles it.
		if (!rows || version !== this.#version) return;

		this.list = parse(rows.map(promptOf));
		this.#keep();
	}

	#keep() {
		if (this.#account) writeCache(CACHE, this.#account, $state.snapshot(this.list));
	}
}

export const prompts = new Prompts();
