// The workout under way: which day of which routine, the sets done so far, and whether a set or a
// rest is running and since when. The clock is never counted down by hand — every timer is worked
// out from when its phase began — so a phone that locks, or a page iOS reloads behind the user's
// back, picks up at the right second.
//
// The session is saved to the database after every set (`sessions`); the phase and its start only
// matter on this device, and stay in it.
import { local, type RutinaBlock } from '@leo-os/shared';
import { pushState } from '$app/navigation';
import { unlockSound } from './device';
import { newId } from './ids';
import { nextSlot, type Routine, type Session } from './routine';
import { routines } from './routines.svelte';
import { sessions } from './sessions.svelte';

export type Phase = 'work' | 'rest' | 'done';

interface Live {
	session: Session;
	phase: Phase;
	/** Epoch milliseconds: when the phase began. */
	since: number;
	/** Seconds the rest under way lasts. */
	rest: number;
}

/** A workout left this long without a set is over: it is not offered to be picked up again. */
const STALE = 4 * 60 * 60 * 1000;

const stored = local<Live | null>('rutina:workout', null);

function isLive(value: unknown): value is Live {
	const live = value as Live | null;
	return (
		typeof live?.session?.id === 'string' &&
		Array.isArray(live.session.sets) &&
		(live.phase === 'work' || live.phase === 'rest' || live.phase === 'done') &&
		typeof live.since === 'number'
	);
}

class Workout {
	#live = $state<Live | null>(null);

	get session(): Session | undefined {
		return this.#live?.session;
	}

	get phase(): Phase | undefined {
		return this.#live?.phase;
	}

	get since(): number {
		return this.#live?.since ?? 0;
	}

	/** Seconds the rest under way lasts. */
	get rest(): number {
		return this.#live?.rest ?? 0;
	}

	routine = $derived(routines.find(this.#live?.session.routineId));
	day = $derived(this.routine?.days.find((day) => day.id === this.#live?.session.dayId));

	/** The set being done, or the one the rest leads to. */
	slot = $derived(this.day && this.#live ? nextSlot(this.day, this.#live.session.sets) : undefined);

	/** Going on, rather than over and showing its summary. */
	active = $derived(Boolean(this.#live && this.#live.phase !== 'done' && this.day));

	/**
	 * Picks up a workout left halfway: the one this device was in, or else — iOS may have dropped
	 * this page, or it was another device — the newest one the database says is not over. Runs once
	 * the routines and the sessions have been read.
	 */
	restore() {
		const saved = stored.value;
		// The database may know better: the workout may have been ended, or gone further, on another
		// device since.
		const fresher = isLive(saved) ? sessions.find(saved.session.id) : undefined;
		if (isLive(saved) && saved.phase !== 'done' && !fresher?.endedAt && this.#current(saved.session)) {
			if (fresher && fresher.sets.length > saved.session.sets.length) {
				saved.session = $state.snapshot(fresher) as Session;
			}
			this.#live = saved;
			return;
		}
		stored.value = null;

		const now = Date.now();
		const open = sessions.list
			.filter((session) => !session.endedAt && session.sets.length && this.#current(session))
			.filter((session) => now - session.sets.at(-1)!.at < STALE)
			.toSorted((a, b) => b.sets.at(-1)!.at - a.sets.at(-1)!.at)[0];
		if (!open) return;

		// Resting still, if the last set was done less than its rest ago.
		const last = open.sets.at(-1)!;
		const day = routines.find(open.routineId)?.days.find((day) => day.id === open.dayId);
		const rest = day?.exercises.find((entry) => entry.id === last.entry)?.rest ?? 0;
		const resting = now - last.at < rest * 1000;
		this.#set({
			session: $state.snapshot(open) as Session,
			phase: resting ? 'rest' : 'work',
			since: resting ? last.at : now,
			rest
		});
	}

	/** Whether a session belongs to a day that is still there, with sets left to do. */
	#current(session: Session): boolean {
		const day = routines.find(session.routineId)?.days.find((day) => day.id === session.dayId);
		return Boolean(day && nextSlot(day, session.sets) && Date.now() - lastActivity(session) < STALE);
	}

	start(routine: Routine, dayId: string) {
		const now = Date.now();
		this.#set({
			session: {
				id: newId(),
				routineId: routine.id,
				dayId,
				startedAt: now,
				endedAt: 0,
				finished: false,
				sets: []
			},
			phase: 'work',
			since: now,
			rest: 0
		});
	}

	/** The set under way is done, at `block`: on to its rest, or to the end if it was the last. */
	complete(block: RutinaBlock) {
		const live = this.#live;
		const slot = this.slot;
		if (!live || live.phase !== 'work' || !slot || !this.day) return;

		const now = Date.now();
		live.session.sets.push({ entry: slot.entry.id, reps: block.reps, weight: block.weight, at: now });

		if (!nextSlot(this.day, live.session.sets)) {
			this.#finish(true);
			return;
		}

		sessions.save(live.session);
		const rest = slot.entry.rest;
		this.#set({ ...live, phase: rest > 0 ? 'rest' : 'work', since: now, rest });
	}

	/** The rest is over, or cut short: the next set starts now. */
	startSet() {
		const live = this.#live;
		if (live?.phase === 'rest') this.#set({ ...live, phase: 'work', since: Date.now() });
	}

	/** Ends the workout before its last round. What was done is kept. */
	end() {
		if (this.#live && this.#live.phase !== 'done') this.#finish(false);
	}

	/** Leaves the summary: there is no workout any more. */
	close() {
		this.#set(null);
	}

	#finish(finished: boolean) {
		const live = this.#live;
		if (!live) return;

		live.session.endedAt = Date.now();
		live.session.finished = finished;
		// A workout ended before its first set leaves nothing behind.
		if (live.session.sets.length) sessions.save(live.session);
		else if (sessions.find(live.session.id)) sessions.remove(live.session.id);
		this.#set({ ...live, phase: 'done', since: live.session.endedAt });
	}

	#set(live: Live | null) {
		this.#live = live;
		stored.value = live && ($state.snapshot(live) as Live);
	}
}

/** When a session last moved: its last set, or its start. */
export function lastActivity(session: Session): number {
	return session.sets.at(-1)?.at ?? session.startedAt;
}

export const workout = new Workout();

/**
 * Starts a day of a routine and opens it. Called from the tap on «Empezar», which is what lets the
 * alarm sound later on.
 */
export function begin(routine: Routine, dayId: string) {
	unlockSound();
	if (workout.active) {
		const question = 'Hay un entrenamiento en curso. ¿Terminarlo y empezar este? Lo que hiciste se guarda.';
		if (!confirm(question)) return;
		workout.end();
	}
	workout.start(routine, dayId);
	pushState('', { routine: routine.id, workout: true });
}

/** Back into the workout under way. */
export function resume() {
	const session = workout.session;
	if (!session) return;
	unlockSound();
	pushState('', { routine: session.routineId, workout: true });
}
