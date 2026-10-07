// The stopwatch, the timer and the clock: where each one is, and what the voice says and when.
//
// Time is read off the clock, never counted in ticks: what the stopwatch has run is now minus when it
// started, with its pauses taken out, and what the timer has left is when it ends minus now. A tick
// only redraws and speaks, so one that comes late — the page was in the background, the phone was
// busy — still lands where the time truly is.
import { local, setting } from '@leo-os/shared';
import { keepAwake, letSleep, startAlarm, stopAlarm } from './device';
import { spokenLeft, spokenRun, spokenTime } from './format';
import { say } from './voice';

/** 23:59:59.99, in milliseconds: the most the stopwatch runs to. */
export const LIMIT = 24 * 60 * 60 * 1000 - 10;

/** 23:59:59: the longest timer. It is picked in whole seconds, and counts down in hundredths. */
export const LONGEST = 24 * 60 * 60 * 1000 - 1000;

/** How often each one may speak, in minutes; 0 is never. */
export const EVERY = [0, 1, 5, 10, 15, 30, 60];

/** Which of the three: the tabs, and what each setting of how often to speak belongs to. */
export type Mode = 'stopwatch' | 'timer' | 'clock';

/** How often each one speaks. A preference, so it lives in the account. */
export const every = {
	stopwatch: setting<number>('reloj:stopwatch-every', 0),
	timer: setting<number>('reloj:timer-every', 0),
	clock: setting<number>('reloj:clock-every', 0)
};

/** The tab last open, kept on this device: it is where the hand goes, not a preference. */
export const tab = local<Mode>('reloj:tab', 'stopwatch');

/** The timer's length last started: the picker starts there. */
export const duration = setting<number>('reloj:timer-duration', 5 * 60 * 1000);

/** A setting as written by whatever version of the app, or tampered with: anything else is never. */
export function minutesOf(mode: Mode): number {
	const value = every[mode].value;
	return EVERY.includes(value) ? value : 0;
}

/** A length the timer can run: whole seconds, between one of them and 23:59:59. Zero is none. */
export function validDuration(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value)
		? Math.min(LONGEST, Math.max(0, Math.round(value / 1000) * 1000))
		: 0;
}

interface Stopwatch {
	/** Epoch milliseconds it started at, moved on by every pause: what it has run is now minus this. */
	startedAt: number;
	/** Epoch milliseconds it was paused at, or null while it runs. */
	pausedAt: number | null;
}

interface Timer {
	/** Milliseconds it was started with. */
	duration: number;
	/** Epoch milliseconds it reaches zero at, while it runs. */
	endsAt: number;
	/** Milliseconds it had left when paused, or null while it runs. Zero once it has reached the end. */
	pausedLeft: number | null;
}

/**
 * Both kept on the device: iOS may close the app while it sits in the background, and opening it again
 * finds them where they would have been.
 */
const savedStopwatch = local<Stopwatch | null>('reloj:stopwatch', null);
const savedTimer = local<Timer | null>('reloj:timer', null);

/** How late a mark may still be said, in milliseconds. Later than this the screen was off. */
const LATE = 3000;

/** A timer that reached zero longer ago than this does not ring when the app comes back to it. */
const STALE = 60 * 1000;

/** How long the alarm rings if nobody stops it. */
const RING = 60 * 1000;

const MINUTE = 60 * 1000;

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function parseStopwatch(raw: unknown): Stopwatch | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const { startedAt, pausedAt } = raw as Record<string, unknown>;
	if (!isNumber(startedAt) || (pausedAt !== null && !isNumber(pausedAt))) return null;
	return { startedAt, pausedAt };
}

function parseTimer(raw: unknown): Timer | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const { duration, endsAt, pausedLeft } = raw as Record<string, unknown>;
	if (!isNumber(duration) || !isNumber(endsAt) || (pausedLeft !== null && !isNumber(pausedLeft))) return null;
	return { duration, endsAt, pausedLeft };
}

class Watch {
	/** The clock as of the last tick, which everything on screen is worked out from. */
	now = $state(Date.now());

	stopwatch = $state<Stopwatch | null>(null);
	timer = $state<Timer | null>(null);

	/** The timer reached zero, and the alarm is going. */
	ringing = $state(false);

	/** Milliseconds the stopwatch has run, up to 23:59:59.99. */
	elapsed = $derived(
		this.stopwatch
			? Math.min(LIMIT, Math.max(0, (this.stopwatch.pausedAt ?? this.now) - this.stopwatch.startedAt))
			: 0
	);
	stopwatchRunning = $derived(this.stopwatch?.pausedAt === null);

	/** Milliseconds the timer has left. */
	left = $derived(
		this.timer ? (this.timer.pausedLeft ?? Math.max(0, this.timer.endsAt - this.now)) : 0
	);
	timerRunning = $derived(this.timer?.pausedLeft === null);
	timerDone = $derived(this.timer?.pausedLeft === 0);

	/** Whether something is to be said or to ring, which the screen has to stay on for. */
	busy = $derived(this.stopwatchRunning || this.timerRunning || this.ringing || minutesOf('clock') > 0);

	/** The last mark each one said, so that every one is said once. */
	#saidClock = Math.floor(Date.now() / MINUTE);
	#saidStopwatch = 0;
	#saidTimer = 0;

	#frame = 0;
	#ring: ReturnType<typeof setTimeout> | undefined;

	constructor() {
		if (typeof document === 'undefined') return;

		// The clock's seconds, and the voice when nothing on screen moves faster. Kept going when the
		// page is hidden, as far as the browser lets it, so that the voice goes on too.
		setInterval(() => this.#tick(), 250);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState !== 'visible') return;
			this.#tick();
			this.#animate();
		});
	}

	/** Picks up what the device kept, if the app was closed with something running. */
	restore() {
		this.stopwatch = parseStopwatch(savedStopwatch.value);
		this.timer = parseTimer(savedTimer.value);
		this.now = Date.now();
		this.#saidStopwatch = Math.floor(this.elapsed / MINUTE);
		this.#saidTimer = Math.ceil(this.left / MINUTE);
		this.#tick();
		this.#animate();
	}

	startStopwatch() {
		const now = Date.now();
		this.stopwatch = { startedAt: now, pausedAt: null };
		this.now = now;
		this.#saidStopwatch = 0;
		this.#save();
		this.#animate();
	}

	pauseStopwatch() {
		if (!this.stopwatch || this.stopwatch.pausedAt !== null) return;
		this.#tick();
		this.stopwatch.pausedAt = Math.min(this.now, this.stopwatch.startedAt + LIMIT);
		this.#save();
	}

	resumeStopwatch() {
		if (!this.stopwatch || this.stopwatch.pausedAt === null || this.elapsed >= LIMIT) return;
		const now = Date.now();
		this.stopwatch.startedAt += now - this.stopwatch.pausedAt;
		this.stopwatch.pausedAt = null;
		this.now = now;
		this.#save();
		this.#animate();
	}

	resetStopwatch() {
		this.stopwatch = null;
		this.#saidStopwatch = 0;
		this.#save();
	}

	startTimer(length: number) {
		const ms = validDuration(length);
		if (!ms) return;
		const now = Date.now();
		this.silence();
		this.timer = { duration: ms, endsAt: now + ms, pausedLeft: null };
		this.now = now;
		// Not said as it starts: «Quedan 10 minutos» right after picking 10 minutes says nothing new.
		this.#saidTimer = Math.ceil(ms / MINUTE);
		if (duration.value !== ms) duration.value = ms;
		this.#save();
		this.#animate();
	}

	pauseTimer() {
		if (!this.timer || this.timer.pausedLeft !== null) return;
		this.#tick();
		if (this.timer.pausedLeft !== null) return;
		this.timer.pausedLeft = this.left;
		this.#save();
	}

	resumeTimer() {
		if (!this.timer || !this.timer.pausedLeft) return;
		const now = Date.now();
		this.timer.endsAt = now + this.timer.pausedLeft;
		this.timer.pausedLeft = null;
		this.now = now;
		this.#save();
		this.#animate();
	}

	/** Drops the timer, running or over, and stops the alarm: back to picking a length. */
	cancelTimer() {
		this.silence();
		this.timer = null;
		this.#save();
	}

	/** Stops the alarm, leaving the timer at zero. */
	silence() {
		clearTimeout(this.#ring);
		stopAlarm();
		this.ringing = false;
	}

	/** «Decir la hora»: the time right now, from a tap. */
	sayTime() {
		say(spokenTime(new Date()));
	}

	/** Keeps the screen on while something is to be said or to ring, and lets it go off otherwise. */
	hold(busy: boolean) {
		if (busy) keepAwake();
		else letSleep();
	}

	#tick() {
		const now = Date.now();
		this.now = now;
		const said: string[] = [];

		// The clock says the time on the marks of the hour: every 15 minutes is :00, :15, :30 and :45.
		const minute = Math.floor(now / MINUTE);
		if (minute !== this.#saidClock) {
			const date = new Date(now);
			const step = minutesOf('clock');
			const mark = (date.getHours() * 60 + date.getMinutes()) % (step || 1) === 0;
			if (step && mark && date.getSeconds() * 1000 + date.getMilliseconds() < LATE) {
				said.push(spokenTime(date));
			}
			this.#saidClock = minute;
		}

		// The stopwatch, on the marks of what it has run: every 5 minutes is 5, 10, 15…
		if (this.stopwatch?.pausedAt === null) {
			if (now - this.stopwatch.startedAt >= LIMIT) {
				// As far as it goes: it stops there, as a stopwatch does.
				this.stopwatch.pausedAt = this.stopwatch.startedAt + LIMIT;
				this.#save();
			}
			const ran = Math.floor(this.elapsed / MINUTE);
			if (ran !== this.#saidStopwatch) {
				const step = minutesOf('stopwatch');
				if (step && ran > this.#saidStopwatch && ran % step === 0 && this.elapsed % MINUTE < LATE) {
					said.push(spokenRun(ran));
				}
				this.#saidStopwatch = ran;
			}
		}

		// The timer, on the marks of what it has left, which is what it shows: every 5 minutes is 10, 5…
		if (this.timer?.pausedLeft === null) {
			if (this.left <= 0) {
				this.timer.pausedLeft = 0;
				this.#save();
				// Back long after it went off, there is nothing left to warn about: it shows it is over.
				if (now - this.timer.endsAt < STALE) {
					said.push('Se acabó el tiempo');
					this.#startRinging();
				}
			} else {
				const left = Math.ceil(this.left / MINUTE);
				if (left !== this.#saidTimer) {
					const step = minutesOf('timer');
					if (step && left < this.#saidTimer && left % step === 0 && left * MINUTE - this.left < LATE) {
						said.push(spokenLeft(left));
					}
					this.#saidTimer = left;
				}
			}
		}

		// One utterance: two in a row may be cut apart, or one of them lost.
		if (said.length) say(said.join('. '));
	}

	#startRinging() {
		this.ringing = true;
		startAlarm();
		clearTimeout(this.#ring);
		this.#ring = setTimeout(() => this.silence(), RING);
	}

	/** Redraws on every frame while the hundredths move; the browser stops it while the page is hidden. */
	#animate() {
		if (this.#frame || typeof requestAnimationFrame === 'undefined') return;
		const frame = () => {
			this.#frame = 0;
			if (!this.stopwatchRunning && !this.timerRunning) return;
			this.#tick();
			this.#frame = requestAnimationFrame(frame);
		};
		this.#frame = requestAnimationFrame(frame);
	}

	#save() {
		savedStopwatch.value = this.stopwatch ? $state.snapshot(this.stopwatch) : null;
		savedTimer.value = this.timer ? $state.snapshot(this.timer) : null;
	}
}

export const watch = new Watch();
