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
	type CardRow,
	type DeckRow
} from '@leo-os/shared';
import {
	answer,
	dayStart,
	isDue,
	START_EASE,
	type CardState,
	type Rating,
	type Schedule
} from './schedule';

export interface Deck {
	id: string;
	name: string;
	/** How many new cards a day brings at most, as in Anki; 0 is every one of them. */
	newPerDay: number;
}

/** What a card says, which is all there is to it until it is studied. */
export interface Draft {
	front: string;
	back: string;
}

export interface Card extends Draft, Schedule {
	id: string;
	deckId: string;
	/** Epoch milliseconds. New cards are studied in the order they were added. */
	createdAt: number;
	/** Epoch milliseconds: when it was first answered, which counts it among that day's new cards. */
	introducedAt: number;
}

export interface DeckCounts {
	total: number;
	/** Never studied yet, as many as the deck lets in today. */
	new: number;
	/** Studied before, and due again now. */
	due: number;
	/** Never studied yet, today's limit or not. */
	unseen: number;
}

/** The new cards a day of a deck brought in from elsewhere, which has thousands: Anki's default. */
export const IMPORTED_PER_DAY = 20;

const DECKS = 'repaso_decks';
const CARDS = 'repaso_cards';
const DECK_COLUMNS = 'id,name,new_per_day';
const CARD_COLUMNS =
	'id,deck_id,front,back,state,step,due_at,interval_days,ease,created_at,introduced_at';

/** Cards per request when a whole deck is sent at once, so that no single request grows too large. */
const BATCH = 500;

/** What this account's decks and cards look like on the device, so the app opens without waiting. */
const CACHE = 'repaso';

/**
 * localStorage holds a few megabytes for the whole site, every app's data and the wallpaper
 * together. A collection taking more than this many characters of it — thousands of cards, as an
 * imported deck brings — is not kept on the device, and is read from the database every time.
 */
const CACHE_LIMIT = 1_500_000;

/** What a card takes in the cache besides its text: the ids and the schedule, with their names. */
const CARD_OVERHEAD = 200;

/**
 * How long after a change the copy on the device is written. Copying thousands of cards takes a
 * while, which the answer that changed one of them should not have to wait for.
 */
const SAVE_DELAY = 1000;

const STATES: CardState[] = ['new', 'learning', 'review', 'relearning'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function whole(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

/** Rows may come from the cache of an earlier version: anything that does not add up is dropped. */
function parseDecks(raw: unknown): Deck[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = text(item.id);
		const name = text(item.name).trim();
		const newPerDay = Math.max(0, whole(item.newPerDay, 0));
		return id && name ? [{ id, name, newPerDay }] : [];
	});
}

function parseCards(raw: unknown): Card[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = text(item.id);
		const deckId = text(item.deckId);
		const front = text(item.front);
		const back = text(item.back);
		if (!id || !deckId || !front.trim() || !back.trim()) return [];

		const state = STATES.find((known) => known === item.state) ?? 'new';
		return [
			{
				id,
				deckId,
				front,
				back,
				state,
				step: whole(item.step, 0),
				due: whole(item.due, 0),
				interval: whole(item.interval, 0),
				ease: whole(item.ease, START_EASE),
				createdAt: whole(item.createdAt, 0),
				introducedAt: whole(item.introducedAt, 0)
			}
		];
	});
}

/** A row of the database, in the shape the app (and `parseDecks`) works in. */
function deckOf(row: DeckRow) {
	return { id: row.id, name: row.name, newPerDay: row.new_per_day };
}

/** A row of the database, in the shape the app (and `parseCards`) works in. */
function cardOf(row: CardRow) {
	return {
		id: row.id,
		deckId: row.deck_id,
		front: row.front,
		back: row.back,
		state: row.state,
		step: row.step,
		due: row.due_at,
		interval: row.interval_days,
		ease: row.ease,
		createdAt: row.created_at,
		introducedAt: row.introduced_at
	};
}

function deckRow(userId: string, deck: Deck): DeckRow {
	return { id: deck.id, user_id: userId, name: deck.name, new_per_day: deck.newPerDay };
}

function cardRow(userId: string, card: Card): CardRow {
	return {
		id: card.id,
		user_id: userId,
		deck_id: card.deckId,
		front: card.front,
		back: card.back,
		...scheduleColumns(card),
		created_at: card.createdAt,
		introduced_at: card.introducedAt
	};
}

/** The columns an answer changes. */
function scheduleColumns(schedule: Schedule) {
	return {
		state: schedule.state,
		step: schedule.step,
		due_at: schedule.due,
		interval_days: schedule.interval,
		ease: schedule.ease
	};
}

/** The `uuid` the tables are keyed by. */
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

/**
 * The order a session goes through what is due: cards being learned whose time has come, then the
 * reviews, then new cards, and last the cards being learned that come due a little later — shown
 * early, rather than waited for, once nothing else is left.
 */
function studyRank(card: Card, now: number): number {
	if (card.state === 'new') return 2;
	if (card.due > now) return 3;
	return card.state === 'review' ? 1 : 0;
}

class Collection {
	decks = $state<Deck[]>([]);
	cards = $state<Card[]>([]);

	/** What «due» is measured against. `tick` moves it on, so the counts follow the clock. */
	now = $state(Date.now());

	/** The account everything on screen belongs to. Empty until `load` has run. */
	#account = '';

	/** Goes up with every change made here, so a read that crossed one knows it is out of date. */
	#version = 0;

	/** A write of the copy on the device, waiting for the changes to settle. */
	#saving?: ReturnType<typeof setTimeout>;

	/**
	 * Reads this account's decks and cards: first what the device remembers of them, so the app opens
	 * with something on screen, then what the database holds. Never throws — with no connection the
	 * cached ones are what is left, and the banner says so.
	 */
	async load(userId: string) {
		this.#account = userId;

		const cached = readCache<{ decks: unknown; cards: unknown }>(CACHE, userId);
		if (cached) {
			this.decks = parseDecks(cached.decks);
			this.cards = parseCards(cached.cards);
		}
		await this.#read();
	}

	/** Reads everything again, e.g. back from the background: another device may have studied. */
	refresh() {
		// A change still on its way is not in what the database would answer.
		if (this.#account && sync.pending === 0) this.#read();
	}

	tick() {
		this.now = Date.now();
	}

	/** In alphabetical order, as Anki lists them. */
	sortedDecks = $derived(this.decks.toSorted((a, b) => a.name.localeCompare(b.name, 'es')));

	#counts = $derived.by(() => {
		const today = dayStart(this.now);
		const counts = new Map<string, Omit<DeckCounts, 'new'> & { introduced: number }>();
		for (const card of this.cards) {
			let entry = counts.get(card.deckId);
			if (!entry) {
				entry = { total: 0, unseen: 0, due: 0, introduced: 0 };
				counts.set(card.deckId, entry);
			}
			entry.total++;
			if (card.state === 'new') entry.unseen++;
			else if (isDue(card, this.now)) entry.due++;
			if (card.introducedAt >= today) entry.introduced++;
		}
		return counts;
	});

	countsOf(deckId: string): DeckCounts {
		const entry = this.#counts.get(deckId);
		if (!entry) return { total: 0, new: 0, due: 0, unseen: 0 };

		const { total, unseen, due, introduced } = entry;
		return { total, unseen, due, new: Math.min(unseen, this.#allowance(deckId, introduced)) };
	}

	/** How many more new cards the deck lets in today, `introduced` having been studied already. */
	#allowance(deckId: string, introduced: number): number {
		const limit = this.decks.find((deck) => deck.id === deckId)?.newPerDay ?? 0;
		return limit ? Math.max(0, limit - introduced) : Infinity;
	}

	/** The deck's cards, newest first: what was just added is at the top. */
	cardsOf(deckId: string): Card[] {
		return this.cards
			.filter((card) => card.deckId === deckId)
			.sort((a, b) => b.createdAt - a.createdAt);
	}

	/** What a session of the deck goes through at `now`, in the order it goes through it. */
	dueIn(deckId: string, now: number): Card[] {
		const today = dayStart(now);
		const introduced = this.cards.filter(
			(card) => card.deckId === deckId && card.introducedAt >= today
		).length;
		// Only the first new cards, as many as the deck lets in today.
		let allowance = this.#allowance(deckId, introduced);

		return this.cards
			.filter((card) => card.deckId === deckId && isDue(card, now))
			.sort(
				(a, b) =>
					studyRank(a, now) - studyRank(b, now) ||
					(a.state === 'new' ? a.createdAt - b.createdAt : a.due - b.due)
			)
			.filter((card) => card.state !== 'new' || allowance-- > 0);
	}

	/** When the deck's next studied card comes due again; 0 when none has been studied. */
	nextDue(deckId: string): number {
		let next = 0;
		for (const card of this.cards) {
			if (card.deckId !== deckId || card.state === 'new') continue;
			if (!next || card.due < next) next = card.due;
		}
		return next;
	}

	addDeck(name: string): Deck {
		const deck = { id: newId(), name: name.trim(), newPerDay: 0 };
		this.decks.push(deck);
		const userId = this.#account;
		this.#push(() => insert(DECKS, deckRow(userId, deck)));
		return deck;
	}

	/**
	 * A deck with its cards, brought whole from elsewhere: an Anki package. The cards go to the
	 * database a batch at a time, one request after the other, and the deck before any of them.
	 */
	importDeck(name: string, drafts: Draft[], newPerDay: number): Deck {
		const deck = { id: newId(), name: name.trim(), newPerDay };
		const added = this.#newCards(deck.id, drafts);
		this.decks.push(deck);
		// Thousands of them: too many to hand `push` one argument each.
		this.cards = [...this.cards, ...added];

		const userId = this.#account;
		this.#push(async () => {
			await insert(DECKS, deckRow(userId, deck));
			for (let start = 0; start < added.length; start += BATCH) {
				const batch = added.slice(start, start + BATCH);
				await insert(CARDS, batch.map((card) => cardRow(userId, card)));
			}
		});
		return deck;
	}

	updateDeck(id: string, name: string, newPerDay: number) {
		const deck = this.decks.find((candidate) => candidate.id === id);
		if (!deck) return;

		deck.name = name.trim();
		deck.newPerDay = newPerDay;
		this.#push(() => update(DECKS, eq('id', id), { name: deck.name, new_per_day: newPerDay }));
	}

	/** Deletes the deck and every card in it. */
	removeDeck(id: string) {
		this.decks = this.decks.filter((deck) => deck.id !== id);
		this.cards = this.cards.filter((card) => card.deckId !== id);
		// Its cards go with it: the column is declared `on delete cascade`.
		this.#push(() => remove(DECKS, eq('id', id)));
	}

	/** Adds cards to the deck in the order given, which is the order they will be studied in. */
	addCards(deckId: string, drafts: Draft[]) {
		const added = this.#newCards(deckId, drafts);
		if (!added.length) return;

		this.cards.push(...added);
		const userId = this.#account;
		this.#push(() => insert(CARDS, added.map((card) => cardRow(userId, card))));
	}

	#newCards(deckId: string, drafts: Draft[]): Card[] {
		const now = Date.now();
		return drafts.map((draft, index) => ({
			id: newId(),
			deckId,
			front: draft.front.trim(),
			back: draft.back.trim(),
			state: 'new',
			step: 0,
			due: 0,
			interval: 0,
			ease: START_EASE,
			// A millisecond apart, so that they keep their order among themselves.
			createdAt: now + index,
			introducedAt: 0
		}));
	}

	updateCard(id: string, draft: Draft) {
		const card = this.cards.find((candidate) => candidate.id === id);
		if (!card) return;

		card.front = draft.front.trim();
		card.back = draft.back.trim();
		this.#push(() => update(CARDS, eq('id', id), { front: card.front, back: card.back }));
	}

	removeCard(id: string) {
		this.cards = this.cards.filter((card) => card.id !== id);
		this.#push(() => remove(CARDS, eq('id', id)));
	}

	/** Records an answer: the card moves on in its schedule. */
	answer(id: string, rating: Rating) {
		const card = this.cards.find((candidate) => candidate.id === id);
		if (!card) return;

		const now = Date.now();
		// Its first answer is what counts a card among the day's new ones.
		if (card.state === 'new') card.introducedAt = now;
		Object.assign(card, answer(card, rating, now));
		const columns = { ...scheduleColumns(card), introduced_at: card.introducedAt };
		this.#push(() => update(CARDS, eq('id', id), columns));
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
		this.#save();
		push(run, () => this.#read());
	}

	/** Puts on screen exactly what the database holds. With no connection, what is there stays. */
	async #read() {
		const version = this.#version;
		const rows = await pull(async () => {
			const [decks, cards] = await Promise.all([
				select<DeckRow>(DECKS, DECK_COLUMNS),
				select<CardRow>(CARDS, CARD_COLUMNS)
			]);
			return { decks, cards };
		});
		// A change made while the rows were on their way is not in them: its own write settles it.
		if (!rows || version !== this.#version) return;

		this.decks = parseDecks(rows.decks.map(deckOf));
		this.cards = parseCards(rows.cards.map(cardOf));
		this.#save();
	}

	#save() {
		if (!this.#account) return;

		clearTimeout(this.#saving);
		this.#saving = setTimeout(() => this.flush(), SAVE_DELAY);
	}

	/** Writes the copy on the device now, if a change is waiting for it: the app is going away. */
	flush() {
		if (this.#saving === undefined) return;
		clearTimeout(this.#saving);
		this.#saving = undefined;

		// Measured before it is copied: a collection too large to keep is not worth copying either.
		let size = 0;
		for (const card of this.cards) size += card.front.length + card.back.length + CARD_OVERHEAD;
		const snapshot =
			size > CACHE_LIMIT
				? null
				: { decks: $state.snapshot(this.decks), cards: $state.snapshot(this.cards) };
		writeCache(CACHE, this.#account, snapshot, CACHE_LIMIT);
	}
}

export const collection = new Collection();
