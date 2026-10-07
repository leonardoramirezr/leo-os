// A program running: where it is, what the voice says and when, and the screen kept on meanwhile.
//
// Time is read off the clock, never counted in ticks: what has run is now minus when the program
// started, with the pauses taken out. A tick only redraws and speaks, so one that comes late — the
// page was in the background, the phone was busy — still lands where the program truly is, which is
// where the treadmill is too: it does not stop because the phone looked away.
import { local } from '@leo-os/shared';
import { spokenSpeed } from './format';
import {
	isRecord,
	lengthOf,
	parseSegments,
	segmentAt,
	type Program,
	type Segment
} from './programs.svelte';
import { hush, say, unlock } from './voice';

export interface Run {
	/** The program as it was when it started: changing it meanwhile does not change this run. */
	program: { id: string; name: string; segments: Segment[] };
	/** Epoch milliseconds it started at, moved on by every pause: what has run is now minus this. */
	startedAt: number;
	/** Epoch milliseconds it was paused at, or null while it runs. */
	pausedAt: number | null;
}

/**
 * The run, kept on the device: iOS may close the app while it sits in the background — a song
 * skipped in another app — and opening it again finds the program where the treadmill is.
 */
const saved = local<Run | null>('caminadora:run', null);

/** A run paused for longer than this is not picked up again: it was left, not paused. */
const ABANDONED = 60 * 60 * 1000;

/** How late a minute may still be said. Later than this the screen was off, and it goes unsaid. */
const LATE = 3;

function changeTo(speed: number): string {
	return `Cambia la velocidad a ${spokenSpeed(speed)}`;
}

/** A run as the device kept it, from whatever version of the app wrote it. */
function parseRun(raw: unknown): Run | null {
	if (!isRecord(raw) || !isRecord(raw.program)) return null;

	const { id, name } = raw.program;
	const segments = parseSegments(raw.program.segments);
	const { startedAt, pausedAt } = raw;
	if (typeof id !== 'string' || typeof name !== 'string' || !segments.length) return null;
	if (typeof startedAt !== 'number' || (pausedAt !== null && typeof pausedAt !== 'number')) return null;

	return { program: { id, name, segments }, startedAt, pausedAt };
}

class Runner {
	run = $state<Run | null>(null);

	/** The clock as of the last tick, which everything on screen is worked out from. */
	now = $state(0);

	/** Seconds the program lasts. */
	total = $derived(this.run ? lengthOf(this.run.program.segments) : 0);

	/** Whole seconds it has run, up to the whole program. */
	elapsed = $derived.by(() => {
		if (!this.run) return 0;
		const ran = (this.run.pausedAt ?? this.now) - this.run.startedAt;
		return Math.min(this.total, Math.max(0, Math.floor(ran / 1000)));
	});

	finished = $derived(this.run !== null && this.elapsed >= this.total);
	paused = $derived(this.run?.pausedAt != null && !this.finished);

	#position = $derived(segmentAt(this.run?.program.segments ?? [], this.elapsed));

	/** Which segment it is in; the last one once it has finished. */
	index = $derived(this.#position.index);
	segment = $derived(this.run?.program.segments[this.#position.index]);

	/** Whole seconds into the segment, and the ones left of it: together, always all of it. */
	segmentElapsed = $derived(this.elapsed - this.#position.start);
	segmentLeft = $derived((this.segment?.seconds ?? 0) - this.segmentElapsed);

	#timer: ReturnType<typeof setTimeout> | undefined;

	/** What the voice has spoken of, so that every minute and every segment is said once. */
	#saidMinute = 0;
	#saidSegment = 0;
	#saidEnd = false;

	#lock: WakeLockSentinel | undefined;
	#locking = false;

	constructor() {
		if (typeof document === 'undefined') return;

		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState !== 'visible' || !this.run) return;
			// Back from the background: the time moved on, and the screen lock went with the page.
			this.#tick();
			if (!this.finished) this.#keepAwake();
		});
	}

	/** Starts a program from its first second. Called during the tap that asks for it. */
	start(program: Program) {
		unlock();
		hush();
		const now = Date.now();
		this.run = {
			program: {
				id: program.id,
				name: program.name,
				segments: $state.snapshot(program.segments)
			},
			startedAt: now,
			pausedAt: null
		};
		this.now = now;
		this.#saidMinute = 0;
		this.#saidSegment = 0;
		this.#saidEnd = false;
		// Inside the tap: on iOS, the first thing said has to be.
		say(changeTo(this.run.program.segments[0].speed));
		this.#save();
		this.#keepAwake();
		this.#schedule();
	}

	pause() {
		if (!this.run || this.run.pausedAt !== null) return;

		// The program may have ended since the last tick: that comes first.
		this.#tick();
		if (this.finished) return;

		this.run.pausedAt = this.now;
		clearTimeout(this.#timer);
		this.#save();
	}

	resume() {
		if (!this.run || this.run.pausedAt === null) return;

		const now = Date.now();
		this.run.startedAt += now - this.run.pausedAt;
		this.run.pausedAt = null;
		this.now = now;
		this.#save();
		this.#keepAwake();
		this.#schedule();
	}

	stop() {
		clearTimeout(this.#timer);
		this.run = null;
		hush();
		this.#letSleep();
		saved.value = null;
	}

	/**
	 * Picks up the run the device kept, if the app was closed in the middle of one. Nothing is said
	 * about what went by meanwhile: it is all on screen.
	 */
	restore() {
		if (this.run) return;

		const run = parseRun(saved.value);
		const now = Date.now();
		const ran = run ? (run.pausedAt ?? now) - run.startedAt : 0;
		const left = run ? lengthOf(run.program.segments) * 1000 - ran : 0;
		if (!run || left <= 0 || (run.pausedAt !== null && now - run.pausedAt > ABANDONED)) {
			if (saved.value) saved.value = null;
			return;
		}

		this.run = run;
		this.now = now;
		this.#saidMinute = Math.floor(this.elapsed / 60);
		this.#saidSegment = this.index;
		this.#saidEnd = false;
		if (run.pausedAt === null) {
			this.#keepAwake();
			this.#schedule();
		}
	}

	#tick() {
		if (!this.run) return;

		this.now = Date.now();
		this.#announce();
		if (this.finished) this.#finish();
		else this.#schedule();
	}

	/** The next tick comes just past the next whole second, which is when the numbers change. */
	#schedule() {
		clearTimeout(this.#timer);
		if (!this.run || this.run.pausedAt !== null) return;

		const into = (((Date.now() - this.run.startedAt) % 1000) + 1000) % 1000;
		this.#timer = setTimeout(() => this.#tick(), 1000 - into + 15);
	}

	#announce() {
		if (!this.run) return;

		if (this.finished) {
			if (!this.#saidEnd) say('Programa terminado');
			this.#saidEnd = true;
			return;
		}

		const said: string[] = [];
		const minute = Math.floor(this.elapsed / 60);
		if (minute !== this.#saidMinute) {
			// Only on the minute: back from the background, the minutes gone by are not caught up on.
			if (minute > this.#saidMinute && this.elapsed % 60 < LATE) said.push(`Minuto ${minute}`);
			this.#saidMinute = minute;
		}
		if (this.index !== this.#saidSegment && this.segment) {
			// Said even when late: the speed the treadmill should be at is what matters right now.
			said.push(changeTo(this.segment.speed));
			this.#saidSegment = this.index;
		}
		// One utterance: two in a row may be cut apart, or one of them lost.
		if (said.length) say(said.join('. '));
	}

	/** Done: the screen may go off again, and there is nothing left to pick up after a reload. */
	#finish() {
		clearTimeout(this.#timer);
		this.#letSleep();
		saved.value = null;
	}

	#save() {
		saved.value = this.run ? $state.snapshot(this.run) : null;
	}

	/**
	 * Keeps the screen on while a program runs: a phone that locks puts the page to sleep, and with
	 * it the voice. The lock goes when the page is hidden, so coming back asks for it again.
	 */
	async #keepAwake() {
		if (this.#locking || (this.#lock && !this.#lock.released)) return;

		this.#locking = true;
		try {
			const lock = await navigator.wakeLock?.request('screen');
			// Stopped or finished while the lock was on its way.
			if (!this.run || this.finished) await lock?.release();
			else this.#lock = lock;
		} catch {
			// Not offered, or refused (low battery, a hidden page): the screen goes off as it would.
		} finally {
			this.#locking = false;
		}
	}

	#letSleep() {
		this.#lock?.release().catch(() => {});
		this.#lock = undefined;
	}
}

export const runner = new Runner();
