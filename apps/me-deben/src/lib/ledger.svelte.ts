import {
	eq,
	insert,
	pull,
	push,
	readCache,
	remove,
	select,
	setting,
	update,
	writeCache,
	type MovementRow,
	type PersonRow
} from '@leo-os/shared';
import { today } from './money';
import { chargeCount, chargeDate, chargesDueBefore, isPlan, type Plan } from './plan';

export interface Person {
	id: string;
	name: string;
}

export type MovementKind = 'loan' | 'payment';

export interface Movement {
	id: string;
	personId: string;
	/** `loan`: I lent it to them. `payment`: they paid me back. */
	kind: MovementKind;
	/** Cents, always positive. `kind` is what gives it a sign. */
	amount: number;
	/** When it was lent (or paid), as "YYYY-MM-DD". */
	date: string;
	/** Loans only: when it is due back. Empty with no agreed date, or with an agreement. */
	dueDate: string;
	/** Payment agreement: charged weekly or monthly. Empty for a single repayment. */
	plan: Plan;
	/** Cents of each charge of the agreement. 0 without an agreement. */
	planAmount: number;
	/** First charge date of the agreement, as "YYYY-MM-DD". Empty without an agreement. */
	planStart: string;
	/** On a loan, my account; on a payment, theirs. Empty when it was not specified. */
	fromBank: string;
	/** On a loan, their account; on a payment, mine. */
	toBank: string;
	note: string;
	/** Breaks the tie between movements sharing a date. */
	createdAt: number;
}

/**
 * The parts of a movement that can be corrected after it was recorded. The person and the kind
 * are not here: changing those makes it another movement, not a correction.
 */
export type MovementEdit = Omit<Movement, 'id' | 'personId' | 'kind' | 'createdAt'>;

/** A person with their balance already worked out, which is what the lists render. */
export interface Balance {
	person: Person;
	/** Cents they owe me. 0 when they are settled up. */
	owed: number;
	/** Cents they owe me that are already past their due date. */
	overdue: number;
}

const PEOPLE = 'me_deben_people';
const MOVEMENTS = 'me_deben_movements';

/** What this account's rows look like on the device, so the app opens without waiting. */
const CACHE = 'me-deben';

/** The keys of the version that kept everything on the device, read once and then left alone. */
const OLD_PEOPLE_KEY = 'me-deben:people';
const OLD_MOVEMENTS_KEY = 'me-deben:movements';
const OLD_MY_BANK_KEY = 'me-deben:my-bank';
const IMPORTED_KEY = 'me-deben:imported';

/** The account I usually lend from, so it need not be picked every time. */
const myBank = setting('me-deben:my-bank', '');

function readLocalText(key: string): string {
	try {
		return localStorage.getItem(key) ?? '';
	} catch {
		// No storage: there is nothing to bring over.
		return '';
	}
}

function readLocal(key: string): unknown {
	try {
		const raw = readLocalText(key);
		return raw === '' ? undefined : JSON.parse(raw);
	} catch {
		// Corrupt data: there is nothing to bring over.
		return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function isDate(value: unknown): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(text(value));
}

/** Data may come from an earlier version, or from another device: anything that does not add up is dropped. */
function parsePeople(raw: unknown): Person[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = text(item.id);
		const name = text(item.name).trim();
		return id && name ? [{ id, name }] : [];
	});
}

function parseMovements(raw: unknown): Movement[] {
	if (!Array.isArray(raw)) return [];

	return raw.filter(isRecord).flatMap((item) => {
		const id = text(item.id);
		const personId = text(item.personId);
		const amount = typeof item.amount === 'number' ? Math.round(item.amount) : 0;
		const date = isDate(item.date) ? text(item.date) : today();
		// What earlier versions stored carried no due date: it stays without one.
		const dueDate = isDate(item.dueDate) ? text(item.dueDate) : '';
		const kind = item.kind === 'payment' ? ('payment' as const) : ('loan' as const);
		// An agreement with no amount or no first charge date cannot be scheduled: it is ignored.
		const planAmount = typeof item.planAmount === 'number' ? Math.round(item.planAmount) : 0;
		const plan: Plan =
			kind === 'loan' && isPlan(item.plan) && planAmount > 0 && isDate(item.planStart)
				? item.plan
				: '';
		if (!id || !personId || !(amount > 0)) return [];

		return [
			{
				id,
				personId,
				kind,
				amount,
				date,
				// With an agreement the charges rule: there is no single due date.
				dueDate: kind === 'payment' || plan !== '' ? '' : dueDate,
				plan,
				planAmount: plan === '' ? 0 : planAmount,
				planStart: plan === '' ? '' : text(item.planStart),
				fromBank: text(item.fromBank),
				toBank: text(item.toBank),
				note: text(item.note),
				createdAt: typeof item.createdAt === 'number' ? item.createdAt : 0
			}
		];
	});
}

/** A row of the database, in the shape the app (and `parseMovements`) works in. */
function movementOf(row: MovementRow) {
	return {
		id: row.id,
		personId: row.person_id,
		kind: row.kind,
		amount: row.amount,
		date: row.date,
		dueDate: row.due_date ?? '',
		plan: row.plan,
		planAmount: row.plan_amount,
		planStart: row.plan_start ?? '',
		fromBank: row.from_bank,
		toBank: row.to_bank,
		note: row.note,
		createdAt: row.created_at
	};
}

function personRow(userId: string, person: Person): PersonRow {
	return { id: person.id, user_id: userId, name: person.name };
}

function movementRow(userId: string, movement: Movement): MovementRow {
	return {
		id: movement.id,
		user_id: userId,
		person_id: movement.personId,
		kind: movement.kind,
		amount: movement.amount,
		date: movement.date,
		// The app says «no date» with '', the column with null.
		due_date: movement.dueDate || null,
		plan: movement.plan,
		plan_amount: movement.planAmount,
		plan_start: movement.planStart || null,
		from_bank: movement.fromBank,
		to_bank: movement.toBank,
		note: movement.note,
		created_at: movement.createdAt
	};
}

/** The columns a correction may touch: everything but who it belongs to and what it is. */
function movementChanges(edit: MovementEdit) {
	return {
		amount: edit.amount,
		date: edit.date,
		due_date: edit.dueDate || null,
		plan: edit.plan,
		plan_amount: edit.planAmount,
		plan_start: edit.planStart || null,
		from_bank: edit.fromBank,
		to_bank: edit.toBank,
		note: edit.note
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

/** Newest first; at the same date, whatever was recorded later. */
function byNewest(a: Movement, b: Movement): number {
	return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
}

/** The date a loan runs by: its due date, or the agreement's first charge. */
function dueAnchor(movement: Movement): string {
	return movement.plan === '' ? movement.dueDate : movement.planStart;
}

/**
 * What comes due first goes first; loans with no due date go last. This is the order payments
 * are applied in: paying settles the most pressing debt first.
 */
function byDueDate(a: Movement, b: Movement): number {
	const dueA = dueAnchor(a) || '9999-12-31';
	const dueB = dueAnchor(b) || '9999-12-31';
	return dueA.localeCompare(dueB) || a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
}

class Ledger {
	people = $state<Person[]>([]);
	movements = $state<Movement[]>([]);

	/** Today, which every due date is compared against. */
	#today = $state(today());

	/** The account everything on screen belongs to. Empty until `load` has run. */
	#account = '';

	/**
	 * Reads this account's ledger: first what the device remembers of it, so the app opens with
	 * something on screen, then what the database holds. Never throws — with no connection the
	 * cached ledger is what is left, and the banner says so.
	 */
	async load(userId: string) {
		this.#account = userId;

		const cached = readCache<{ people: unknown; movements: unknown }>(CACHE, userId);
		if (cached) {
			this.people = parsePeople(cached.people);
			this.movements = parseMovements(cached.movements);
		}

		if (await this.#read()) await this.#importOldDevice();
	}

	/** Puts on screen exactly what the database holds. False when it could not be reached. */
	async #read(): Promise<boolean> {
		const rows = await pull(async () => ({
			people: await select<PersonRow>(PEOPLE, 'id,name'),
			movements: await select<MovementRow>(MOVEMENTS)
		}));
		if (!rows) return false;

		this.people = parsePeople(rows.people);
		this.movements = parseMovements(rows.movements.map(movementOf));
		this.#save();
		return true;
	}

	/** The app may stay open from one day to the next: coming back recomputes what is overdue. */
	refreshToday() {
		this.#today = today();
	}

	get myBank(): string {
		return myBank.value;
	}

	set myBank(bank: string) {
		myBank.value = bank;
	}

	#save() {
		if (!this.#account) return;

		writeCache(CACHE, this.#account, {
			people: $state.snapshot(this.people),
			movements: $state.snapshot(this.movements)
		});
	}

	/**
	 * Sends a change already applied on screen. If the database refuses it, the ledger is read
	 * again so that what is on screen is what was saved — reading it beats putting back a copy
	 * taken before, which a change made in between would have made wrong.
	 *
	 * With no connection there is nothing to read either: what was typed stays on screen and the
	 * banner says it is not saved, which beats throwing it away over a moment without signal.
	 */
	#push(run: () => Promise<void>) {
		this.#save();
		push(run, () => this.#read());
	}

	/**
	 * Brings over what this device kept before there were accounts. It runs once, and only into an
	 * empty ledger, so nothing is ever recorded twice. What was on the device is left where it is.
	 */
	async #importOldDevice() {
		if (this.people.length || this.movements.length) return;
		if (readLocalText(IMPORTED_KEY) !== '') return;

		const people = parsePeople(readLocal(OLD_PEOPLE_KEY));
		const known = new Set(people.map((person) => person.id));
		// A movement of a person that is no longer there has nowhere to hang: the column requires one.
		const movements = parseMovements(readLocal(OLD_MOVEMENTS_KEY)).filter((movement) =>
			known.has(movement.personId)
		);

		if (people.length) {
			const userId = this.#account;
			this.people = people;
			this.movements = movements;
			this.#push(async () => {
				// People first: every movement points at one of them.
				await insert(PEOPLE, people.map((person) => personRow(userId, person)));
				if (movements.length) {
					await insert(MOVEMENTS, movements.map((movement) => movementRow(userId, movement)));
				}
			});
		}

		// The old version kept this one as plain text, not as JSON like the other two.
		const bank = readLocalText(OLD_MY_BANK_KEY);
		if (!myBank.value && bank) myBank.value = bank;

		try {
			localStorage.setItem(IMPORTED_KEY, new Date().toISOString());
		} catch {
			// No storage: the guard above is the database being empty, which it no longer is.
		}
	}

	/** Balance per person: loans minus payments, in cents. */
	#balances = $derived.by(() => {
		const totals = new Map<string, number>();
		for (const movement of this.movements) {
			const signed = movement.kind === 'loan' ? movement.amount : -movement.amount;
			totals.set(movement.personId, (totals.get(movement.personId) ?? 0) + signed);
		}
		return totals;
	});

	/** Each person's loans (soonest due first) with everything they have paid so far. */
	#byPerson = $derived.by(() => {
		const entries = new Map<string, { loans: Movement[]; paid: number }>();
		for (const movement of this.movements) {
			let entry = entries.get(movement.personId);
			if (!entry) {
				entry = { loans: [], paid: 0 };
				entries.set(movement.personId, entry);
			}
			if (movement.kind === 'loan') entry.loans.push(movement);
			else entry.paid += movement.amount;
		}
		for (const entry of entries.values()) entry.loans.sort(byDueDate);
		return entries;
	});

	/**
	 * Cents left to cover on each loan. Payments are not recorded against a particular loan, so
	 * they are spread over the ones that come due first.
	 */
	#pending = $derived.by(() => {
		const pending = new Map<string, number>();
		for (const { loans, paid } of this.#byPerson.values()) {
			let credit = paid;
			for (const loan of loans) {
				const applied = Math.min(credit, loan.amount);
				credit -= applied;
				pending.set(loan.id, loan.amount - applied);
			}
		}
		return pending;
	});

	/** What is already overdue per person, summed loan by loan. */
	#overdues = $derived.by(() => {
		const overdues = new Map<string, number>();
		for (const [personId, { loans }] of this.#byPerson) {
			overdues.set(
				personId,
				loans.reduce((sum, loan) => sum + this.overdueOn(loan), 0)
			);
		}
		return overdues;
	});

	/** Everyone with their balance: whoever is overdue first, then whoever owes the most. */
	balances = $derived.by((): Balance[] =>
		this.people
			.map((person) => ({
				person,
				owed: this.#balances.get(person.id) ?? 0,
				overdue: this.#overdues.get(person.id) ?? 0
			}))
			.sort(
				(a, b) =>
					b.overdue - a.overdue ||
					b.owed - a.owed ||
					a.person.name.localeCompare(b.person.name, 'es')
			)
	);

	/** Whoever owes me something right now. */
	debtors = $derived(this.balances.filter((entry) => entry.owed > 0));

	/** Recorded people who owe nothing: they paid up, or were just added. */
	settled = $derived(this.balances.filter((entry) => entry.owed <= 0));

	/** Everything I am owed. A balance in someone's favor does not subtract from the total. */
	total = $derived(this.debtors.reduce((sum, entry) => sum + entry.owed, 0));

	/** Everything overdue, across all people. */
	totalOverdue = $derived(this.debtors.reduce((sum, entry) => sum + entry.overdue, 0));

	owedBy(personId: string): number {
		return this.#balances.get(personId) ?? 0;
	}

	overdueBy(personId: string): number {
		return this.#overdues.get(personId) ?? 0;
	}

	/** Cents left to cover on a loan. A payment has nothing pending: it is 0. */
	pendingOn(movement: Movement): number {
		return this.#pending.get(movement.id) ?? 0;
	}

	/**
	 * Cents of a loan that should already be paid today: all of it once its due date passed, or
	 * the sum of the agreement's charges that are behind us.
	 */
	#dueSoFar(movement: Movement): number {
		if (movement.plan !== '') {
			const charges = chargesDueBefore(movement.planStart, movement.plan, this.#today);
			return Math.min(movement.amount, charges * movement.planAmount);
		}
		return movement.dueDate !== '' && movement.dueDate < this.#today ? movement.amount : 0;
	}

	/** What is overdue on a loan: what should already be paid and is still uncovered. */
	overdueOn(movement: Movement): number {
		if (movement.kind !== 'loan') return 0;

		const covered = movement.amount - this.pendingOn(movement);
		return Math.max(0, this.#dueSoFar(movement) - covered);
	}

	/** A loan with something overdue: its due date passed, or it is missing a charge. */
	isOverdue(movement: Movement): boolean {
		return this.overdueOn(movement) > 0;
	}

	/**
	 * The date of an agreement's next charge still to come. Empty once the loan is paid off, or
	 * once every charge is behind us, which is when only the overdue part is left.
	 */
	nextChargeOn(movement: Movement): string {
		if (movement.kind !== 'loan' || movement.plan === '' || this.pendingOn(movement) === 0) {
			return '';
		}

		const next = chargesDueBefore(movement.planStart, movement.plan, this.#today);
		const total = chargeCount(movement.amount, movement.planAmount);
		return next < total ? chargeDate(movement.planStart, movement.plan, next) : '';
	}

	movementsOf(personId: string): Movement[] {
		return this.movements.filter((movement) => movement.personId === personId).sort(byNewest);
	}

	/** Looks up a name ignoring case and surrounding spaces, so people are not duplicated. */
	findByName(name: string): Person | undefined {
		const wanted = name.trim().toLocaleLowerCase('es');
		return this.people.find((person) => person.name.toLocaleLowerCase('es') === wanted);
	}

	addPerson(name: string): Person {
		const person = { id: newId(), name: name.trim() };
		this.people.push(person);
		this.#push(() => insert(PEOPLE, personRow(this.#account, person)));

		// The array's element, not the loose object: whoever gets it then sees renames.
		return this.people[this.people.length - 1];
	}

	renamePerson(id: string, name: string) {
		const person = this.people.find((candidate) => candidate.id === id);
		if (!person) return;

		person.name = name.trim();
		this.#push(() => update(PEOPLE, eq('id', id), { name: person.name }));
	}

	/** Deletes the person and their whole history. */
	removePerson(id: string) {
		this.people = this.people.filter((person) => person.id !== id);
		this.movements = this.movements.filter((movement) => movement.personId !== id);
		// Their movements go with them: the column is declared `on delete cascade`.
		this.#push(() => remove(PEOPLE, eq('id', id)));
	}

	addMovement(movement: Omit<Movement, 'id' | 'createdAt'>) {
		const recorded = { ...movement, id: newId(), createdAt: Date.now() };
		this.movements.push(recorded);
		this.#push(() => insert(MOVEMENTS, movementRow(this.#account, recorded)));
	}

	/** Corrects a movement recorded with wrong data. `createdAt` is left alone: it breaks ties. */
	updateMovement(id: string, changes: MovementEdit) {
		const movement = this.movements.find((candidate) => candidate.id === id);
		if (!movement) return;

		Object.assign(movement, changes);
		this.#push(() => update(MOVEMENTS, eq('id', id), movementChanges(changes)));
	}

	removeMovement(id: string) {
		this.movements = this.movements.filter((movement) => movement.id !== id);
		this.#push(() => remove(MOVEMENTS, eq('id', id)));
	}
}

export const ledger = new Ledger();
