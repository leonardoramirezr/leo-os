// The answers given to each template, kept for good: on the device the instant they are typed, in
// the database as soon as there is a connection, and from there on every device of the account.
//
// Offline first. Every change goes to IndexedDB at once, with `edited_at` — the moment of the edit,
// in UTC — and `dirty` until the database has it. Sending waits for a pause in the typing (1.5 s,
// and never more than 10 s since the first change still unsent), and goes at once when the page is
// hidden, loses the focus or is left, with `keepalive` so that it outlives the page. Only one
// request is ever on its way. With no connection everything waits on the device, and is sent when
// the connection comes back; a request that fails is tried again, further and further apart.
//
// Two devices may have edited the same answers apart: the later edit wins, whole, wherever it was
// made. The database only replaces a row with a later one and hands back the newer of the two
// (`plantillas_save_answers`), and opening a template or coming back online compares both copies.
// Every moment is a UTC ISO 8601 string ending in Z, here and on the wire; only the screen shows
// local time.
import { dataApiSchema, isExpired, rpc, session, type PlantillasAnswersRow } from '@leo-os/shared';
import * as store from './store';

/** What travels to and from the database. */
type Saved = Pick<PlantillasAnswersRow, 'id' | 'content' | 'edited_at'>;

/** What is kept on the device, by template. */
interface Entry extends Saved {
	/** Edited here and not yet in the database. */
	dirty: boolean;
}

/** The pause in the typing that sends what was typed. */
const DEBOUNCE = 1500;
/** However long the typing goes on, what was typed is not held back for longer than this. */
const MAX_WAIT = 10_000;
/** How long the first retry waits; each one after it waits twice as long, up to `RETRY_MAX`. */
const RETRY_FIRST = 2000;
const RETRY_MAX = 60_000;
/** The browser refuses a `keepalive` request over 64 KB: a larger one goes out as any other. */
const KEEPALIVE_LIMIT = 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A moment as UTC ISO 8601 ending in Z, or '' when it is not one. */
function utc(value: unknown): string {
	if (typeof value !== 'string') return '';
	const time = Date.parse(value);
	return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

/** A row from the database, or from IndexedDB, checked; `undefined` when it does not add up. */
function savedOf(raw: unknown): Saved | undefined {
	if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.content !== 'string') return undefined;
	const edited_at = utc(raw.edited_at);
	return edited_at ? { id: raw.id, content: raw.content, edited_at } : undefined;
}

/** The answers by question, out of what the database keeps. */
function answersOf(content: string): Record<string, string> {
	try {
		const parsed: unknown = JSON.parse(content);
		if (!isRecord(parsed)) return {};
		return Object.fromEntries(
			Object.entries(parsed).filter((pair): pair is [string, string] => typeof pair[1] === 'string')
		);
	} catch {
		return {};
	}
}

class Answers {
	#entries = $state<Record<string, Entry>>({});

	/** The answers by template, ready to show. */
	#parsed = $derived(
		Object.fromEntries(Object.entries(this.#entries).map(([id, entry]) => [id, answersOf(entry.content)]))
	);

	/** Whether the browser says there is a connection. */
	online = $state(typeof navigator === 'undefined' || navigator.onLine);

	/** The account, and the schema, every key on the device starts with. Empty until `load`. */
	#prefix = '';

	#debounce: ReturnType<typeof setTimeout> | undefined;
	/** When the oldest change not yet sent was made, for `MAX_WAIT`; 0 with none. */
	#since = 0;

	#retry: ReturnType<typeof setTimeout> | undefined;
	#attempts = 0;

	/** Whether a request is on its way: only ever one. */
	#busy = false;
	/** What is owed to the database once the request on its way is back. */
	#wantRead = false;
	#wantWrite = false;
	#keepalive = false;

	answersTo(id: string): Record<string, string> {
		return this.#parsed[id] ?? {};
	}

	/** When the answers to a template were last edited, on any device; '' for never. */
	editedAt(id: string): string {
		return this.#entries[id]?.edited_at ?? '';
	}

	/** Whether the answers to a template are on this device only, waiting to be sent. */
	pending(id: string): boolean {
		return this.#entries[id]?.dirty ?? false;
	}

	/**
	 * Puts on screen what the device keeps for this account, then compares it with the database in
	 * the background. Answers to a template that is no longer there are dropped.
	 */
	async load(userId: string, templates: string[]) {
		this.#prefix = `${dataApiSchema}:${userId}:`;

		const known = new Set(templates);
		const entries: Record<string, Entry> = {};
		for (const raw of await store.all(this.#prefix)) {
			const saved = savedOf(raw);
			if (saved && known.has(saved.id)) entries[saved.id] = { ...saved, dirty: isRecord(raw) && raw.dirty === true };
			else if (saved) store.remove(this.#prefix + saved.id);
		}
		this.#entries = entries;
		this.sync();
	}

	answer(id: string, question: string, value: string) {
		this.#edit(id, { ...this.answersTo(id), [question]: value });
	}

	/** Empties a template's answers, for the next prompt made out of it. An edit like any other. */
	clear(id: string) {
		if (this.#entries[id]) this.#edit(id, {});
	}

	/** The template is gone: so are its answers, here and — by the database itself — there. */
	forget(id: string) {
		delete this.#entries[id];
		if (this.#prefix) store.remove(this.#prefix + id);
	}

	/** Drops the answers to every template but these: the ones that were deleted on another device. */
	keepOnly(templates: string[]) {
		const known = new Set(templates);
		for (const id of Object.keys(this.#entries)) if (!known.has(id)) this.forget(id);
	}

	/** Compares every copy with the database's, keeps the later of each, and sends what is newer here. */
	sync() {
		this.#wantRead = true;
		this.#wantWrite = true;
		this.#run();
	}

	/** Sends what is pending now, without waiting for the pause in the typing. */
	flush(keepalive = false) {
		clearTimeout(this.#debounce);
		this.#debounce = undefined;
		this.#since = 0;
		this.#wantWrite = true;
		this.#keepalive ||= keepalive;
		this.#run();
	}

	/** Listens for what sends the answers at once, or brings the database back into step. */
	listen(): () => void {
		const visibility = () => {
			if (document.visibilityState === 'hidden') this.flush(true);
			else this.sync();
		};
		const leave = () => this.flush(true);
		const online = () => {
			this.online = true;
			// Whatever was waiting out a failure goes now.
			clearTimeout(this.#retry);
			this.#retry = undefined;
			this.#attempts = 0;
			this.sync();
		};
		const offline = () => (this.online = false);

		document.addEventListener('visibilitychange', visibility);
		window.addEventListener('blur', leave);
		window.addEventListener('pagehide', leave);
		window.addEventListener('online', online);
		window.addEventListener('offline', offline);
		return () => {
			document.removeEventListener('visibilitychange', visibility);
			window.removeEventListener('blur', leave);
			window.removeEventListener('pagehide', leave);
			window.removeEventListener('online', online);
			window.removeEventListener('offline', offline);
		};
	}

	#edit(id: string, answers: Record<string, string>) {
		const before = this.#entries[id];
		// Never before the edit it follows, even with this device's clock behind the one that made it:
		// an edit made over another one has to win over it.
		const time = Math.max(Date.now(), before ? Date.parse(before.edited_at) + 1 : 0);
		this.#entries[id] = {
			id,
			content: JSON.stringify(answers),
			edited_at: new Date(time).toISOString(),
			dirty: true
		};
		this.#store(id);
		this.#schedule();
	}

	/** Copies a template's answers to IndexedDB as they are now. */
	#store(id: string) {
		const entry = this.#entries[id];
		if (entry && this.#prefix) store.put(this.#prefix + id, $state.snapshot(entry));
	}

	/** Sends after a pause in the typing, or once the oldest change waiting has waited long enough. */
	#schedule() {
		const now = Date.now();
		this.#since ||= now;
		clearTimeout(this.#debounce);
		this.#debounce = setTimeout(() => this.flush(), Math.max(0, Math.min(DEBOUNCE, this.#since + MAX_WAIT - now)));
	}

	/** Does what is owed to the database, one request at a time, for as long as there is a connection. */
	async #run() {
		// One request at a time; and waiting out a failure, only the page going away jumps the queue.
		if (this.#busy || !this.#prefix || (this.#retry && !this.#keepalive)) return;

		this.#busy = true;
		let step: 'read' | 'write' | undefined;
		try {
			while (navigator.onLine) {
				if (this.#wantRead) {
					step = 'read';
					this.#wantRead = false;
					this.#merge(await rpc<unknown>('plantillas_read_answers', {}), true);
				} else if (this.#wantWrite) {
					step = 'write';
					this.#wantWrite = false;
					const keepalive = this.#keepalive;
					this.#keepalive = false;
					await this.#write(keepalive);
				} else break;
			}
			this.#attempts = 0;
		} catch (thrown) {
			if (step === 'read') this.#wantRead = true;
			else this.#wantWrite = true;
			// What is pending stays on the device, and goes once signed in again.
			if (isExpired(thrown)) session.expire();
			else this.#retryLater();
		} finally {
			this.#busy = false;
		}
	}

	async #write(keepalive: boolean) {
		const batch: Saved[] = Object.values(this.#entries)
			.filter((entry) => entry.dirty)
			.map(({ id, content, edited_at }) => ({ id, content, edited_at }));
		if (!batch.length) return;

		const fits = JSON.stringify(batch).length < KEEPALIVE_LIMIT;
		const rows = await rpc<unknown>('plantillas_save_answers', { answers: batch }, { keepalive: keepalive && fits });
		this.#merge(rows, false);
	}

	/**
	 * Settles every copy the database handed back against this device's: the later edit wins. A whole
	 * read (`all`) also finds what the database lacks, which is then sent.
	 */
	#merge(raw: unknown, all: boolean) {
		if (!Array.isArray(raw)) return;

		const seen = new Set<string>();
		for (const row of raw) {
			const saved = savedOf(row);
			if (!saved) continue;
			seen.add(saved.id);

			const local = this.#entries[saved.id];
			const theirs = Date.parse(saved.edited_at);
			const ours = local ? Date.parse(local.edited_at) : -Infinity;

			if (local && ours > theirs) {
				// Edited here after: still to be sent, whatever the database holds meanwhile.
				if (!local.dirty) {
					local.dirty = true;
					this.#store(saved.id);
				}
				this.#wantWrite = true;
			} else if (!local || theirs > ours || local.content !== saved.content) {
				// The database's is later — or, edited at the very same moment, the one it kept.
				this.#entries[saved.id] = { ...saved, dirty: false };
				this.#store(saved.id);
			} else if (local.dirty) {
				// The database has exactly this.
				local.dirty = false;
				this.#store(saved.id);
			}
		}

		if (!all) return;
		for (const [id, local] of Object.entries(this.#entries)) {
			if (seen.has(id)) continue;
			// Never reached the database, or it lost them (a preview's copy made anew): send them.
			if (!local.dirty) {
				local.dirty = true;
				this.#store(id);
			}
			this.#wantWrite = true;
		}
	}

	/** Tries again later, waiting twice as long as the time before. Offline, `online` is what retries. */
	#retryLater() {
		if (!navigator.onLine || this.#retry) return;

		const delay = Math.min(RETRY_MAX, RETRY_FIRST * 2 ** this.#attempts);
		this.#attempts++;
		// Spread a little, so that several tabs that failed together do not all retry together.
		this.#retry = setTimeout(
			() => {
				this.#retry = undefined;
				this.#run();
			},
			delay * (0.75 + Math.random() / 2)
		);
	}
}

export const answers = new Answers();
