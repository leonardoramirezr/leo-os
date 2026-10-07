// The numbers behind the summary at the end of a workout and the statistics' charts. Volume is
// series × repetitions × kilograms — added up set by set, since sets may differ —; the average is
// the repetitions and the kilograms of a set, on average.
import type { RutinaBlock, RutinaDay, RutinaEntry, RutinaSet } from '@leo-os/shared';
import { volumeOf } from './effort';
import { lastSessionWith, setsOf, slotsOf, type Session } from './routine';

export type Metric = 'volume' | 'average';

/** A value at a moment: one per session in the charts. */
export interface Point {
	at: number;
	value: number;
}

/**
 * How the volume of some sets is measured. With no weight anywhere — chin-ups, a plank — kilograms
 * times repetitions would be zero every time, so the repetitions (or seconds) themselves are added
 * up instead. Against the clock and with weight, it is kilograms times seconds: `kgs`.
 */
export type VolumeUnit = 'kg' | 'kgs' | 'reps' | 's';

export function volumeUnit(sets: RutinaBlock[], timed: boolean): VolumeUnit {
	if (sets.some((set) => set.weight > 0)) return timed ? 'kgs' : 'kg';
	return timed ? 's' : 'reps';
}

function measure(sets: RutinaBlock[], unit: VolumeUnit): number {
	return unit === 'kg' || unit === 'kgs' ? volumeOf(sets) : sets.reduce((sum, set) => sum + set.reps, 0);
}

/** The exercises of a day done against the clock: their seconds do not add up with repetitions. */
function timedIn(day: RutinaDay): Set<string> {
	return new Set(day.exercises.filter((entry) => entry.timed).map((entry) => entry.id));
}

function average(values: number[]): number {
	return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

/** One chart's worth: what it plots, in what, and from which sets. */
export interface Series {
	unit: VolumeUnit;
	volume: Point[];
	reps: Point[];
	weight: Point[];
}

/**
 * The evolution of some sets, one point per session: their volume, and their average repetitions
 * and weight. `pick` says which of a session's sets count — those of a day, or of one exercise.
 */
function seriesOf(sessions: Session[], pick: (session: Session) => RutinaSet[], timed: boolean): Series {
	const picked = sessions
		.map((session) => ({ at: session.startedAt, sets: pick(session) }))
		.filter(({ sets }) => sets.length)
		.toSorted((a, b) => a.at - b.at);

	const unit = volumeUnit(
		picked.flatMap(({ sets }) => sets),
		timed
	);
	return {
		unit,
		volume: picked.map(({ at, sets }) => ({ at, value: measure(sets, unit) })),
		reps: picked.map(({ at, sets }) => ({ at, value: average(sets.map((set) => set.reps)) })),
		weight: picked.map(({ at, sets }) => ({ at, value: average(sets.map((set) => set.weight)) }))
	};
}

/**
 * Every set of a day, session after session — but those against the clock, whose seconds do not
 * add up with repetitions, unless the whole day is.
 */
export function daySeries(sessions: Session[], day: RutinaDay): Series {
	const timed = timedIn(day);
	const all = day.exercises.length > 0 && timed.size === day.exercises.length;
	return seriesOf(
		sessions.filter((session) => session.dayId === day.id),
		(session) => (all ? session.sets : session.sets.filter((set) => !timed.has(set.entry))),
		all
	);
}

/** One exercise of a day, session after session. */
export function entrySeries(sessions: Session[], entry: RutinaEntry): Series {
	return seriesOf(sessions, (session) => setsOf(session, entry.id), entry.timed);
}

export interface EntrySummary {
	entry: RutinaEntry;
	sets: RutinaSet[];
	unit: VolumeUnit;
	volume: number;
	/** Its volume the time before, in the same unit; `undefined` the first time. */
	before?: number;
}

export interface Summary {
	duration: number;
	done: number;
	planned: number;
	/** Repetitions, leaving out the seconds of the exercises against the clock. */
	reps: number;
	/** Kilograms moved: every set's repetitions times its weight, again with no seconds in it. */
	volume: number;
	entries: EntrySummary[];
}

/** What a workout came to, exercise by exercise, against the time before. */
export function summarize(session: Session, day: RutinaDay, all: Session[]): Summary {
	const entries = day.exercises.flatMap((entry): EntrySummary[] => {
		const sets = setsOf(session, entry.id);
		if (!sets.length) return [];

		const previous = lastSessionWith(
			all.filter((other) => other.startedAt < session.startedAt),
			entry.id,
			session.id
		);
		const before = previous ? setsOf(previous, entry.id) : [];
		const unit = volumeUnit([...sets, ...before], entry.timed);
		return [
			{
				entry,
				sets,
				unit,
				volume: measure(sets, unit),
				before: before.length ? measure(before, unit) : undefined
			}
		];
	});

	const end = session.endedAt || session.sets.at(-1)?.at || session.startedAt;
	const timed = timedIn(day);
	const counted = session.sets.filter((set) => !timed.has(set.entry));
	return {
		duration: end - session.startedAt,
		done: session.sets.length,
		planned: slotsOf(day).length,
		reps: counted.reduce((sum, set) => sum + set.reps, 0),
		volume: volumeOf(counted),
		entries
	};
}
