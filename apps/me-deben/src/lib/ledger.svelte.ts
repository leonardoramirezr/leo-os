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
	/** `loan`: le presté. `payment`: ya me pagó. */
	kind: MovementKind;
	/** Centavos, siempre positivo. El signo lo da `kind`. */
	amount: number;
	/** Cuándo se prestó (o se pagó), en "AAAA-MM-DD". */
	date: string;
	/** Solo en un préstamo: cuándo se debe devolver. Vacío si no se pactó fecha o si hay acuerdo. */
	dueDate: string;
	/** Acuerdo de pago: cobro por semana o por mes. Vacío si se pactó una sola devolución. */
	plan: Plan;
	/** Centavos de cada cobro del acuerdo. 0 si no hay acuerdo. */
	planAmount: number;
	/** Primera fecha de cobro del acuerdo, en "AAAA-MM-DD". Vacío si no hay acuerdo. */
	planStart: string;
	/** En un préstamo, mi cuenta; en un pago, la suya. Vacío si no se especificó. */
	fromBank: string;
	/** En un préstamo, su cuenta; en un pago, la mía. */
	toBank: string;
	note: string;
	/** Para desempatar movimientos con la misma fecha. */
	createdAt: number;
}

/**
 * Los datos de un movimiento que se pueden corregir después de capturarlo. La persona y el
 * tipo no están: cambiarlos es otro movimiento, no una corrección.
 */
export type MovementEdit = Omit<Movement, 'id' | 'personId' | 'kind' | 'createdAt'>;

/** Una persona con su saldo ya calculado, que es lo que pintan las listas. */
export interface Balance {
	person: Person;
	/** Centavos que me debe. 0 si está al corriente. */
	owed: number;
	/** Centavos que me debe y ya pasaron de su fecha de devolución. */
	overdue: number;
}

// Todas las apps del sitio comparten el origen: las claves van con prefijo.
const PEOPLE_KEY = 'me-deben:people';
const MOVEMENTS_KEY = 'me-deben:movements';
const MY_BANK_KEY = 'me-deben:my-bank';

function read<T>(key: string, sanitize: (raw: unknown) => T[]): T[] {
	try {
		const raw = localStorage.getItem(key);
		return raw === null ? [] : sanitize(JSON.parse(raw));
	} catch {
		// Sin almacenamiento o con datos corruptos: se empieza vacío en vez de romper la app.
		return [];
	}
}

function readString(key: string): string {
	try {
		return localStorage.getItem(key) ?? '';
	} catch {
		return '';
	}
}

function save(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Almacenamiento lleno o bloqueado: los cambios viven solo en esta sesión.
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

/** Lo guardado pudo escribirlo una versión anterior: se descarta lo que no cuadre. */
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
		// Lo guardado por versiones anteriores no traía fecha de devolución: se queda sin vencimiento.
		const dueDate = isDate(item.dueDate) ? text(item.dueDate) : '';
		const kind = item.kind === 'payment' ? ('payment' as const) : ('loan' as const);
		// Un acuerdo sin monto o sin primera fecha de cobro no se puede calendarizar: se ignora.
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
				// Con acuerdo de pago mandan los cobros: no hay una sola fecha de devolución.
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

function newId(): string {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Más reciente primero; a igual fecha, lo capturado después. */
function byNewest(a: Movement, b: Movement): number {
	return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
}

/** La fecha por la que corre un préstamo: la de devolución, o el primer cobro del acuerdo. */
function dueAnchor(movement: Movement): string {
	return movement.plan === '' ? movement.dueDate : movement.planStart;
}

/**
 * Lo que vence primero, primero; los préstamos sin fecha de devolución, al final.
 * Es el orden en que se aplican los pagos: quien paga salda antes lo más urgente.
 */
function byDueDate(a: Movement, b: Movement): number {
	const dueA = dueAnchor(a) || '9999-12-31';
	const dueB = dueAnchor(b) || '9999-12-31';
	return dueA.localeCompare(dueB) || a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
}

class Ledger {
	people = $state<Person[]>([]);
	movements = $state<Movement[]>([]);

	/** La cuenta desde la que suelo prestar, para no elegirla cada vez. */
	#myBank = $state('');

	/** El día de hoy, contra el que se compara cada fecha de devolución. */
	#today = $state(today());

	constructor() {
		this.people = read(PEOPLE_KEY, parsePeople);
		this.movements = read(MOVEMENTS_KEY, parseMovements);
		this.#myBank = readString(MY_BANK_KEY);
	}

	/** La app puede quedar abierta de un día para otro: al volver se recalcula lo vencido. */
	refreshToday() {
		this.#today = today();
	}

	get myBank(): string {
		return this.#myBank;
	}

	set myBank(bank: string) {
		this.#myBank = bank;
		try {
			localStorage.setItem(MY_BANK_KEY, bank);
		} catch {
			// Sin almacenamiento: el valor por omisión dura lo que la sesión.
		}
	}

	/** Saldo por persona: préstamos menos pagos, en centavos. */
	#balances = $derived.by(() => {
		const totals = new Map<string, number>();
		for (const movement of this.movements) {
			const signed = movement.kind === 'loan' ? movement.amount : -movement.amount;
			totals.set(movement.personId, (totals.get(movement.personId) ?? 0) + signed);
		}
		return totals;
	});

	/** Préstamos de cada persona (los que vencen antes, primero) con lo que ya pagó en total. */
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
	 * Centavos que falta cubrir de cada préstamo. Los pagos no se capturan contra un préstamo
	 * en concreto, así que se reparten sobre los que vencen primero.
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

	/** Lo que ya venció de cada persona, sumando préstamo por préstamo. */
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

	/** Todas las personas con su saldo: primero quien tiene vencido, luego quien más debe. */
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

	/** Quienes me deben algo ahora mismo. */
	debtors = $derived(this.balances.filter((entry) => entry.owed > 0));

	/** Registrados que no deben nada: ya pagaron, o apenas se agregaron. */
	settled = $derived(this.balances.filter((entry) => entry.owed <= 0));

	/** Suma de lo que me deben. Un saldo a favor de alguien no resta al total. */
	total = $derived(this.debtors.reduce((sum, entry) => sum + entry.owed, 0));

	/** Suma de lo vencido de todas las personas. */
	totalOverdue = $derived(this.debtors.reduce((sum, entry) => sum + entry.overdue, 0));

	owedBy(personId: string): number {
		return this.#balances.get(personId) ?? 0;
	}

	overdueBy(personId: string): number {
		return this.#overdues.get(personId) ?? 0;
	}

	/** Centavos que faltan por cubrir de un préstamo. Un pago no tiene pendiente: es 0. */
	pendingOn(movement: Movement): number {
		return this.#pending.get(movement.id) ?? 0;
	}

	/**
	 * Centavos de un préstamo que ya debían estar pagados hoy: todo si pasó su fecha de
	 * devolución, o lo que suman los cobros del acuerdo que ya quedaron atrás.
	 */
	#dueSoFar(movement: Movement): number {
		if (movement.plan !== '') {
			const charges = chargesDueBefore(movement.planStart, movement.plan, this.#today);
			return Math.min(movement.amount, charges * movement.planAmount);
		}
		return movement.dueDate !== '' && movement.dueDate < this.#today ? movement.amount : 0;
	}

	/** Lo vencido de un préstamo: lo que ya debía estar pagado y sigue sin cubrirse. */
	overdueOn(movement: Movement): number {
		if (movement.kind !== 'loan') return 0;

		const covered = movement.amount - this.pendingOn(movement);
		return Math.max(0, this.#dueSoFar(movement) - covered);
	}

	/** Un préstamo con algo vencido: pasó su fecha de devolución, o le falta un cobro del acuerdo. */
	isOverdue(movement: Movement): boolean {
		return this.overdueOn(movement) > 0;
	}

	/**
	 * La fecha del siguiente cobro de un acuerdo que todavía está por venir. Vacía si el préstamo
	 * ya se pagó o si todos sus cobros quedaron atrás, que es cuando solo queda lo vencido.
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

	/** Busca por nombre sin distinguir mayúsculas ni espacios, para no duplicar personas. */
	findByName(name: string): Person | undefined {
		const wanted = name.trim().toLocaleLowerCase('es');
		return this.people.find((person) => person.name.toLocaleLowerCase('es') === wanted);
	}

	addPerson(name: string): Person {
		this.people.push({ id: newId(), name: name.trim() });
		save(PEOPLE_KEY, this.people);
		// El elemento del arreglo, no el objeto suelto: así quien lo reciba ve los cambios de nombre.
		return this.people[this.people.length - 1];
	}

	renamePerson(id: string, name: string) {
		const person = this.people.find((candidate) => candidate.id === id);
		if (!person) return;

		person.name = name.trim();
		save(PEOPLE_KEY, this.people);
	}

	/** Borra a la persona y todo su historial. */
	removePerson(id: string) {
		this.people = this.people.filter((person) => person.id !== id);
		this.movements = this.movements.filter((movement) => movement.personId !== id);
		save(PEOPLE_KEY, this.people);
		save(MOVEMENTS_KEY, this.movements);
	}

	addMovement(movement: Omit<Movement, 'id' | 'createdAt'>) {
		this.movements.push({ ...movement, id: newId(), createdAt: Date.now() });
		save(MOVEMENTS_KEY, this.movements);
	}

	/** Corrige un movimiento capturado con un dato equivocado. `createdAt` no se toca: es el desempate. */
	updateMovement(id: string, changes: MovementEdit) {
		const movement = this.movements.find((candidate) => candidate.id === id);
		if (!movement) return;

		Object.assign(movement, changes);
		save(MOVEMENTS_KEY, this.movements);
	}

	removeMovement(id: string) {
		this.movements = this.movements.filter((movement) => movement.id !== id);
		save(MOVEMENTS_KEY, this.movements);
	}
}

export const ledger = new Ledger();
