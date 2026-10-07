// What a routine is made of and the rules that go through it: the order a day's sets come in, the
// effort each set is expected at, and which day is today's. Nothing here keeps state.
import type { RutinaBlock, RutinaDay, RutinaEntry, RutinaSet } from '@leo-os/shared';
import { exerciseOf, normalize } from './catalog';
import { sameBlock } from './effort';
import { shortId } from './ids';

export interface Routine {
	id: string;
	name: string;
	days: RutinaDay[];
	/** Epoch milliseconds. */
	createdAt: number;
}

export interface Session {
	id: string;
	routineId: string;
	dayId: string;
	/** Epoch milliseconds. */
	startedAt: number;
	/** Epoch milliseconds; 0 while it is going on. */
	endedAt: number;
	/** Every round done, rather than ended early. */
	finished: boolean;
	/** Oldest first. */
	sets: RutinaSet[];
}

/** A set of a day, in the order the workout goes through them. */
export interface Slot {
	entry: RutinaEntry;
	/** 1-based. Each round does one set of every exercise, so it is also the set's number. */
	round: number;
}

/** The defaults of a new exercise, and of whatever an import leaves out. */
export const DEFAULTS = { sets: 3, reps: 10, timedReps: 30, rest: 90, work: 60 };

export const LIMITS = { sets: 20, reps: 1000, seconds: 3600 };

/** What an exercise of a day is called: its own name, else the catalog's. */
export function entryName(entry: RutinaEntry): string {
	return entry.name.trim() || exerciseOf(entry.exercise)?.name || 'Ejercicio';
}

/** A new exercise for a day, from the catalog or of the user's own (`exercise` empty). */
export function newEntry(exercise: string, name = ''): RutinaEntry {
	const timed = Boolean(exerciseOf(exercise)?.timed);
	return {
		id: shortId(),
		exercise,
		name,
		sets: DEFAULTS.sets,
		reps: timed ? DEFAULTS.timedReps : DEFAULTS.reps,
		timed,
		// Against the clock, the set's timer is the set itself.
		work: timed ? DEFAULTS.timedReps : DEFAULTS.work,
		rest: DEFAULTS.rest,
		last: [],
		media: ''
	};
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** A name for the next day added: the weekday after the last one named so, else «Día N». */
export function nextDayName(days: RutinaDay[]): string {
	const last = days.at(-1);
	const weekday = last ? weekdayOf(last) : -1;
	if (!last) return 'Lunes';
	if (weekday >= 0) return WEEKDAY_NAMES[(weekday + 1) % 7];
	return `Día ${days.length + 1}`;
}

export function newDay(days: RutinaDay[]): RutinaDay {
	return { id: shortId(), name: nextDayName(days), exercises: [] };
}

/** The weekday a day is named after, 0 for Sunday; -1 for one that is not. «Lunes», «Día 1 · lunes». */
function weekdayOf(day: RutinaDay): number {
	const words = normalize(day.name).split(' ');
	return WEEKDAYS.findIndex((weekday) => words.includes(weekday));
}

/**
 * The day to train: the one named after today's weekday, else the one after the day trained last,
 * else the first. `today` says which of the first two it was.
 */
export function dayFor(
	routine: Routine,
	sessions: Session[],
	date = new Date()
): { day: RutinaDay; today: boolean } | undefined {
	const named = routine.days.find((day) => weekdayOf(day) === date.getDay());
	if (named) return { day: named, today: true };

	const last = sessions
		.filter((session) => session.routineId === routine.id && session.sets.length)
		.toSorted((a, b) => b.startedAt - a.startedAt)
		.find((session) => routine.days.some((day) => day.id === session.dayId));
	const index = last ? routine.days.findIndex((day) => day.id === last.dayId) : -1;
	const day = routine.days[(index + 1) % routine.days.length];
	return day ? { day, today: false } : undefined;
}

/**
 * The order a day's sets are done in: round after round, one set of each exercise per round, and an
 * exercise whose sets are all done drops out of the rounds that follow.
 */
export function slotsOf(day: RutinaDay): Slot[] {
	const rounds = Math.max(0, ...day.exercises.map((entry) => entry.sets));
	const slots: Slot[] = [];
	for (let round = 1; round <= rounds; round++) {
		for (const entry of day.exercises) if (entry.sets >= round) slots.push({ entry, round });
	}
	return slots;
}

/** The first set of the day not done yet; `undefined` once they all are. */
export function nextSlot(day: RutinaDay, sets: RutinaSet[]): Slot | undefined {
	const done = new Map<string, number>();
	for (const set of sets) done.set(set.entry, (done.get(set.entry) ?? 0) + 1);
	return slotsOf(day).find((slot) => (done.get(slot.entry.id) ?? 0) < slot.round);
}

/** How many rounds the day has: as many as the exercise with the most sets. */
export function roundsOf(day: RutinaDay): number {
	return Math.max(0, ...day.exercises.map((entry) => entry.sets));
}

/** The sets one exercise of a day got in a session, oldest first. */
export function setsOf(session: Session, entryId: string): RutinaSet[] {
	return session.sets.filter((set) => set.entry === entryId);
}

/** The newest session other than `exclude` that did that exercise: where its expected effort comes from. */
export function lastSessionWith(sessions: Session[], entryId: string, exclude = ''): Session | undefined {
	let latest: Session | undefined;
	for (const session of sessions) {
		if (session.id === exclude || !session.sets.some((set) => set.entry === entryId)) continue;
		if (!latest || session.startedAt > latest.startedAt) latest = session;
	}
	return latest;
}

/** The oldest session that did that exercise: its first block of work in the app. */
export function firstSessionWith(sessions: Session[], entryId: string): Session | undefined {
	let first: Session | undefined;
	for (const session of sessions) {
		if (!session.sets.some((set) => set.entry === entryId)) continue;
		if (!first || session.startedAt < first.startedAt) first = session;
	}
	return first;
}

function blockOf(set: RutinaBlock): RutinaBlock {
	return { reps: set.reps, weight: set.weight };
}

/**
 * The effort set `round` of an exercise is expected at: what that set was the last time — or, past
 * the sets it had then, its last one —, else the block given when the routine was written, else
 * the routine's repetitions with no weight.
 *
 * Within a session, once a set comes out different from what was expected, the sets after it
 * expect what was just done: the weight on the bar is the one the user moved on to.
 */
export function expectedBlock(
	entry: RutinaEntry,
	round: number,
	current: RutinaSet[],
	previous: RutinaSet[]
): RutinaBlock {
	const planned = (n: number): RutinaBlock => {
		const from = previous.length ? previous : entry.last;
		const block = from[n - 1] ?? from.at(-1);
		return block ? blockOf(block) : { reps: entry.reps, weight: 0 };
	};

	const done = current.filter((set) => set.entry === entry.id);
	if (done.some((set, index) => !sameBlock(set, planned(index + 1)))) return blockOf(done.at(-1)!);
	return planned(round);
}

/** The latest sets of an exercise in the app — or, before any, the block it was written with. */
export function lastBlocks(entry: RutinaEntry, sessions: Session[]): RutinaBlock[] {
	const session = lastSessionWith(sessions, entry.id);
	return session ? setsOf(session, entry.id).map(blockOf) : entry.last;
}

/** The first sets of an exercise in the app — or the block it was written with, if it was. */
export function firstBlocks(entry: RutinaEntry, sessions: Session[]): RutinaBlock[] {
	if (entry.last.length) return entry.last;
	const session = firstSessionWith(sessions, entry.id);
	return session ? setsOf(session, entry.id).map(blockOf) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function whole(value: unknown, min: number, max: number, fallback: number): number {
	const number = typeof value === 'number' ? Math.round(value) : NaN;
	return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function blocks(value: unknown): RutinaBlock[] {
	if (!Array.isArray(value)) return [];
	return value.filter(isRecord).flatMap((block) => {
		const reps = whole(block.reps, 0, LIMITS.reps, 0);
		const weight = typeof block.weight === 'number' && block.weight >= 0 ? block.weight : 0;
		return reps ? [{ reps, weight }] : [];
	});
}

function entry(raw: Record<string, unknown>): RutinaEntry[] {
	const id = text(raw.id);
	// Kept even when the catalog no longer has it: the name and the history are still the user's.
	const exercise = text(raw.exercise);
	const name = text(raw.name);
	if (!id || (!exercise && !name.trim())) return [];

	return [
		{
			id,
			exercise,
			name,
			sets: whole(raw.sets, 1, LIMITS.sets, DEFAULTS.sets),
			reps: whole(raw.reps, 1, LIMITS.reps, DEFAULTS.reps),
			timed: raw.timed === true,
			work: whole(raw.work, 0, LIMITS.seconds, 0),
			rest: whole(raw.rest, 0, LIMITS.seconds, DEFAULTS.rest),
			last: blocks(raw.last),
			media: text(raw.media)
		}
	];
}

/**
 * A routine's days as the database or the device hands them over. Rows may come from an earlier
 * version, or from a hand that edited them: whatever does not add up is dropped.
 */
export function parseDays(raw: unknown): RutinaDay[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(isRecord).flatMap((day) => {
		const id = text(day.id);
		if (!id) return [];
		const exercises = Array.isArray(day.exercises) ? day.exercises.filter(isRecord).flatMap(entry) : [];
		return [{ id, name: text(day.name), exercises }];
	});
}

export function parseSets(raw: unknown): RutinaSet[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(isRecord).flatMap((set) => {
		const entry = text(set.entry);
		const reps = whole(set.reps, 0, LIMITS.reps, 0);
		const weight = typeof set.weight === 'number' && set.weight >= 0 ? set.weight : 0;
		const at = typeof set.at === 'number' ? set.at : 0;
		return entry && reps ? [{ entry, reps, weight, at }] : [];
	});
}
