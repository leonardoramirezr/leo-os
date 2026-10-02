// The text on screen, which is the one text an account has, and the versions it went through during
// this visit: what undo and redo walk, and what the changes view compares.
//
// A change is on screen first and in the database a moment later, so that typing, or undo tapped
// several times, goes out once. Until the database has it, the copy on the device says so, and the
// next time the app opens that copy is sent rather than read over: a dictation is not lost to a
// moment without signal, nor to a session that ran out halfway.
import { pull, push, readCache, select, sync, upsert, writeCache, type DictationRow } from '@leo-os/shared';

const TABLE = 'dictado_texts';

/** What this account's text looks like on the device, so the app opens without waiting. */
const CACHE = 'dictado';

/** How far back undo goes. Only this visit's versions: they are never saved. */
const VERSIONS = 100;

/** Typing counts as a single change for undo until it pauses this long, in milliseconds. */
const TYPING_PAUSE = 1500;

/** How long a change waits to be saved, in milliseconds, in case another one follows. */
const SAVE_DELAY = 800;

/** A version of the text, as undo and redo walk them. */
interface Version {
	text: string;
	/**
	 * What the model was asked for to make it: «Mejorar texto», or what Editar was told. None for a
	 * version dictated or typed: only the model's can be shown with what it changed.
	 */
	by?: string;
}

/** What the model changed last: the text it was given and the text as it is now. */
export interface Comparison {
	before: string;
	after: string;
	/** What it was asked for. */
	by: string;
	/** The text was changed afterwards, dictated or typed, and the comparison shows that too. */
	edited: boolean;
}

interface Copy {
	text: string;
	/** Not in the database yet. */
	unsaved: boolean;
}

/** The copy may come from an earlier version, or be anything at all: what does not add up is dropped. */
function parseCopy(raw: unknown): Copy {
	const copy = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
	return { text: typeof copy.text === 'string' ? copy.text : '', unsaved: copy.unsaved === true };
}

class Draft {
	/** What is on screen. */
	text = $state('');

	/** Every version of the text during this visit, oldest first. The one on screen is at `#at`. */
	#versions = $state.raw<Version[]>([{ text: '' }]);
	#at = $state(0);

	/** The account the text belongs to. Empty until `load` has run. */
	#account = '';
	/** Goes up with every change made here, so a read or a save that crossed one knows it is out of date. */
	#version = 0;
	#unsaved = false;
	#typing = false;
	#typingTimer: ReturnType<typeof setTimeout> | undefined;
	#saveTimer: ReturnType<typeof setTimeout> | undefined;

	get canUndo(): boolean {
		return this.#at > 0;
	}

	get canRedo(): boolean {
		return this.#at < this.#versions.length - 1;
	}

	/**
	 * What the model changed last, to the text on screen: from what it was given to what there is
	 * now, whatever was dictated or typed since included. None when the model is not behind the text
	 * on screen — it was only dictated and typed, or emptied since, which begins another text.
	 */
	comparison = $derived.by((): Comparison | undefined => {
		const after = this.#versions[this.#at].text;
		for (let i = this.#at; i > 0; i--) {
			const version = this.#versions[i];
			if (!version.text.trim()) return undefined;
			if (version.by === undefined) continue;

			const before = this.#versions[i - 1].text;
			if (!before.trim()) return undefined;
			return { before, after, by: version.by, edited: i < this.#at };
		}
		return undefined;
	});

	/**
	 * Reads this account's text: first the copy on the device, then what the database holds, unless
	 * the copy has something the database does not, which is sent instead. Never throws — with no
	 * connection the copy is what is left, and the banner says so.
	 */
	async load(userId: string) {
		this.#account = userId;
		const copy = parseCopy(readCache(CACHE, userId));
		this.#start(copy.text);
		this.#unsaved = copy.unsaved;

		if (copy.unsaved) this.#send();
		else await this.#read(true);
	}

	/** Back from the background: sends what did not make it, or reads the text again, in case it changed on another device. */
	refresh() {
		// A save still on its way, or text being typed, is not in what the database would answer.
		if (!this.#account || this.#typing || this.#saveTimer || sync.pending > 0) return;

		if (this.#unsaved) this.#send();
		else this.#read(false);
	}

	/** Saves right away what is waiting to be: the app is going to the background, where it may be stopped. */
	flush() {
		if (this.#saveTimer) this.#send();
	}

	/**
	 * A new version: dictated, emptied, or what the model made of the text, asked for what `by` says.
	 * Whatever had been undone before it is gone.
	 */
	set(next: string, by?: string) {
		this.settle();
		if (next === this.text) return;

		this.#add(by === undefined ? { text: next } : { text: next, by });
		this.#changed();
	}

	/** Typed by hand. Typing without a pause is a single version, which undo takes back whole. */
	type(next: string) {
		if (next === this.text) return;

		if (this.#typing) {
			this.#versions = this.#versions.with(this.#at, { text: next });
			this.text = next;
		} else {
			this.#add({ text: next });
			this.#typing = true;
		}
		clearTimeout(this.#typingTimer);
		this.#typingTimer = setTimeout(() => (this.#typing = false), TYPING_PAUSE);
		this.#changed();
	}

	/** Typing is over, e.g. the text lost the focus: the next key pressed starts another version. */
	settle() {
		clearTimeout(this.#typingTimer);
		this.#typing = false;
	}

	undo() {
		this.settle();
		if (this.canUndo) this.#show(this.#at - 1);
	}

	redo() {
		this.settle();
		if (this.canRedo) this.#show(this.#at + 1);
	}

	#start(text: string) {
		this.#versions = [{ text }];
		this.#at = 0;
		this.text = text;
	}

	#add(version: Version) {
		const versions = [...this.#versions.slice(0, this.#at + 1), version].slice(-VERSIONS);
		this.#versions = versions;
		this.#at = versions.length - 1;
		this.text = version.text;
	}

	#show(at: number) {
		this.#at = at;
		this.text = this.#versions[at].text;
		this.#changed();
	}

	/** A change made here: on the device right away, in the database a moment later. */
	#changed() {
		this.#version++;
		this.#unsaved = true;
		this.#keep();
		clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => this.#send(), SAVE_DELAY);
	}

	#send() {
		clearTimeout(this.#saveTimer);
		this.#saveTimer = undefined;

		const userId = this.#account;
		const text = this.text;
		const version = this.#version;
		push(
			async () => {
				await upsert(TABLE, { user_id: userId, text });
				// Saved, unless it changed again on the way: that change has a save of its own coming.
				if (version === this.#version) {
					this.#unsaved = false;
					this.#keep();
				}
			},
			// Refused, or no connection: it stays on screen and on the device, marked as not saved, and
			// goes out with the next change, when the app comes back, or the next time it opens. Reading
			// the database again would put back what it had before the dictation.
			() => {}
		);
	}

	/** Puts on screen what the database holds. With no connection, what is there stays. */
	async #read(first: boolean) {
		const version = this.#version;
		const rows = await pull(() => select<DictationRow>(TABLE, 'text'));
		// A change made while the row was on its way is not in it: its own save settles it.
		if (!rows || version !== this.#version) return;

		const text = rows[0]?.text ?? '';
		if (text === this.text) return;

		// Opening, it is the text there is. Later on it changed on another device, and it comes in as
		// one more version, so that undo still reaches what this one had.
		if (first) this.#start(text);
		else this.#add({ text });
		this.#keep();
	}

	#keep() {
		if (this.#account) {
			writeCache(CACHE, this.#account, { text: this.text, unsaved: this.#unsaved } satisfies Copy);
		}
	}
}

export const draft = new Draft();
