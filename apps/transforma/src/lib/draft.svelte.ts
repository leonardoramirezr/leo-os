// The text every prompt works on, and the versions it went through: what undo and redo walk, and
// what the changes view compares.
//
// The versions are kept with the text, in the database. Pasting the result elsewhere means going
// to another app, and iOS often closes this one meanwhile: undo, and the changes a prompt made,
// still have to be there on coming back.
//
// A change is on screen first and in the database a moment later, so that typing, or undo tapped
// several times, goes out once. Until the database has it, the copy on the device says so, and the
// next time the app opens that copy is sent rather than read over: nothing is lost to a moment
// without signal, nor to a session that ran out halfway.
import {
	pull,
	push,
	readCache,
	select,
	sync,
	upsert,
	writeCache,
	type TransformaTextRow,
	type TransformaVersion
} from '@leo-os/shared';

const TABLE = 'transforma_texts';

/** What this account's text looks like on the device, so the app opens without waiting. */
const CACHE = 'transforma:text';

/** How far back undo goes… */
const VERSIONS = 50;

/** …while all the versions together stay under this many characters: every save sends them whole. */
const CHARACTERS = 100_000;

/** Typing counts as a single change for undo until it pauses this long, in milliseconds. */
const TYPING_PAUSE = 1500;

/** How long a change waits to be saved, in milliseconds, in case another one follows. */
const SAVE_DELAY = 800;

/** What a prompt changed: the text it was given and the text as it is now. */
export interface Comparison {
	before: string;
	after: string;
	/** The prompt, by the name it had then. */
	prompt: string;
	/** The text was changed by hand afterwards, and the comparison shows that too. */
	edited: boolean;
}

interface History {
	versions: TransformaVersion[];
	/** Which of them is on screen. */
	current: number;
}

interface Copy extends History {
	/** Not in the database yet. */
	unsaved: boolean;
}

const BLANK: History = { versions: [{ text: '' }], current: 0 };

/** From the database or the device, possibly written by an earlier version: what does not add up is dropped. */
function parseHistory(versions: unknown, current: unknown): History {
	const parsed = (Array.isArray(versions) ? versions : []).flatMap((item): TransformaVersion[] => {
		if (typeof item !== 'object' || item === null) return [];
		const { text, prompt } = item as Record<string, unknown>;
		if (typeof text !== 'string') return [];
		return [typeof prompt === 'string' ? { text, prompt } : { text }];
	});
	if (!parsed.length) return BLANK;

	const last = parsed.length - 1;
	const at = typeof current === 'number' && Number.isInteger(current) ? current : last;
	return { versions: parsed, current: Math.min(Math.max(at, 0), last) };
}

function parseCopy(raw: unknown): Copy {
	const copy = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
	return { ...parseHistory(copy.versions, copy.current), unsaved: copy.unsaved === true };
}

class Draft {
	/** What is on screen. */
	text = $state('');

	/** Every version of the text, oldest first. The one on screen is at `#at`. */
	#versions = $state.raw<TransformaVersion[]>(BLANK.versions);
	#at = $state(0);

	/** The account the text belongs to. Empty until `load` has run. */
	#account = '';
	/** Goes up with every change made here, so a read or a save that crossed one knows it is out of date. */
	#changes = 0;
	#unsaved = false;
	#typing = false;
	#typingTimer: ReturnType<typeof setTimeout> | undefined;
	#saveTimer: ReturnType<typeof setTimeout> | undefined;

	canUndo = $derived(this.#at > 0);
	canRedo = $derived(this.#at < this.#versions.length - 1);

	/**
	 * What the last prompt changed, to the text on screen: from what that prompt was given to what
	 * there is now, edits by hand included. None when no prompt is behind the text on screen — it
	 * was typed or pasted, or emptied since, which begins another text.
	 */
	comparison = $derived.by((): Comparison | undefined => {
		const after = this.#versions[this.#at].text;
		for (let i = this.#at; i > 0; i--) {
			const version = this.#versions[i];
			if (!version.text.trim()) return undefined;
			if (version.prompt === undefined) continue;

			const before = this.#versions[i - 1].text;
			if (!before.trim()) return undefined;
			return { before, after, prompt: version.prompt, edited: i < this.#at };
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
		this.#show(copy);
		this.#unsaved = copy.unsaved;

		if (copy.unsaved) this.#send();
		else await this.#read();
	}

	/** Back from the background: sends what did not make it, or reads the text again, in case it changed on another device. */
	refresh() {
		// A save still on its way, or text being typed, is not in what the database would answer.
		if (!this.#account || this.#typing || this.#saveTimer || sync.pending > 0) return;

		if (this.#unsaved) this.#send();
		else this.#read();
	}

	/** Saves right away what is waiting to be: the app is going to the background, where it may be stopped. */
	flush() {
		if (this.#saveTimer) this.#send();
	}

	/**
	 * A new version: pasted, cleared, or what `prompt` turned the text into. Whatever had been
	 * undone before it is gone.
	 */
	set(next: string, prompt?: string) {
		this.settle();
		if (next === this.text) return;

		this.#add(prompt === undefined ? { text: next } : { text: next, prompt });
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
		if (!this.canUndo) return;
		this.#at--;
		this.text = this.#versions[this.#at].text;
		this.#changed();
	}

	redo() {
		this.settle();
		if (!this.canRedo) return;
		this.#at++;
		this.text = this.#versions[this.#at].text;
		this.#changed();
	}

	#show({ versions, current }: History) {
		this.settle();
		this.#versions = versions;
		this.#at = current;
		this.text = versions[current].text;
	}

	/** Puts `version` after the one on screen, and lets the oldest go once there are too many. */
	#add(version: TransformaVersion) {
		const versions = [...this.#versions.slice(0, this.#at + 1), version];

		let total = 0;
		let first = versions.length - 1;
		// From the newest back, as many as fit; the one on screen always does.
		while (first > 0 && versions.length - first < VERSIONS) {
			total += versions[first].text.length;
			if (total + versions[first - 1].text.length > CHARACTERS) break;
			first--;
		}

		this.#versions = versions.slice(first);
		this.#at = this.#versions.length - 1;
		this.text = version.text;
	}

	/** A change made here: on the device right away, in the database a moment later. */
	#changed() {
		this.#changes++;
		this.#unsaved = true;
		this.#keep();
		clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => this.#send(), SAVE_DELAY);
	}

	#send() {
		clearTimeout(this.#saveTimer);
		this.#saveTimer = undefined;

		const row: TransformaTextRow = {
			user_id: this.#account,
			versions: this.#versions,
			current: this.#at
		};
		const changes = this.#changes;
		push(
			async () => {
				await upsert(TABLE, row);
				// Saved, unless it changed again on the way: that change has a save of its own coming.
				if (changes === this.#changes) {
					this.#unsaved = false;
					this.#keep();
				}
			},
			// Refused, or no connection: it stays on screen and on the device, marked as not saved, and
			// goes out with the next change, when the app comes back, or the next time it opens. Reading
			// the database again would put back what it had before.
			() => {}
		);
	}

	/** Puts on screen what the database holds. With no connection, what is there stays. */
	async #read() {
		const changes = this.#changes;
		const rows = await pull(() => select<TransformaTextRow>(TABLE, 'versions,current'));
		// A change made while the row was on its way is not in it: its own save settles it.
		if (!rows || changes !== this.#changes) return;

		const history = rows[0] ? parseHistory(rows[0].versions, rows[0].current) : BLANK;
		const same =
			history.current === this.#at && JSON.stringify(history.versions) === JSON.stringify(this.#versions);
		if (same) return;

		this.#show(history);
		this.#keep();
	}

	#keep() {
		if (!this.#account) return;
		const copy: Copy = { versions: this.#versions, current: this.#at, unsaved: this.#unsaved };
		writeCache(CACHE, this.#account, copy);
	}
}

export const draft = new Draft();
