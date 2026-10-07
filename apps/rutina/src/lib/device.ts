// What the workout asks of the phone: an alarm that goes on until a button stops it, a screen that
// stays on between sets, and landscape where the browser lets a page ask for it.

let context: AudioContext | undefined;
let ringing: ReturnType<typeof setInterval> | undefined;

function audio(): AudioContext | undefined {
	if (context) return context;
	const Context =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
	try {
		context = Context && new Context();
	} catch {
		context = undefined;
	}
	return context;
}

/**
 * Called on every tap of the workout. A page may only start making sound from a tap, and the alarm
 * goes off when nobody is touching the screen: opening the audio here, and playing a moment of
 * silence through it as iOS wants, is what lets it sound later. iOS also suspends it while the app
 * is in the background, so it is woken up again on each tap.
 */
export function unlockSound() {
	const ctx = audio();
	if (!ctx) return;
	if (ctx.state !== 'running') ctx.resume().catch(() => {});
	try {
		const source = ctx.createBufferSource();
		source.buffer = ctx.createBuffer(1, 1, 22050);
		source.connect(ctx.destination);
		source.start();
	} catch {
		// No sound to unlock: the alarm will be only what the screen shows.
	}
}

function beep(ctx: AudioContext, at: number) {
	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	oscillator.type = 'square';
	oscillator.frequency.value = 1400;
	// Ramps in and out over a few milliseconds: a square wave switched on and off at once clicks.
	gain.gain.setValueAtTime(0, at);
	gain.gain.linearRampToValueAtTime(0.22, at + 0.008);
	gain.gain.setValueAtTime(0.22, at + 0.07);
	gain.gain.linearRampToValueAtTime(0, at + 0.08);
	oscillator.connect(gain).connect(ctx.destination);
	oscillator.start(at);
	oscillator.stop(at + 0.09);
}

/** Four quick beeps and a pause: an alarm clock's. */
function burst() {
	const ctx = audio();
	if (!ctx) return;
	if (ctx.state === 'suspended') ctx.resume().catch(() => {});
	const start = ctx.currentTime + 0.02;
	for (let i = 0; i < 4; i++) beep(ctx, start + i * 0.14);
	// Where a phone can vibrate from a page — not an iPhone —, it does too.
	navigator.vibrate?.(450);
}

export function startAlarm() {
	if (ringing) return;
	burst();
	ringing = setInterval(burst, 1000);
}

export function stopAlarm() {
	if (!ringing) return;
	clearInterval(ringing);
	ringing = undefined;
	navigator.vibrate?.(0);
}

/** The test in the settings: one burst, from a tap. */
export function testAlarm() {
	unlockSound();
	burst();
}

let awake: WakeLockSentinel | undefined;
let wanted = false;

async function acquire() {
	try {
		awake = await navigator.wakeLock?.request('screen');
	} catch {
		// Refused (a page in the background, a battery saver): the screen may lock, the timers go on.
	}
}

/** The lock goes when the page is hidden, and does not come back by itself. */
function onvisibility() {
	if (wanted && document.visibilityState === 'visible' && (!awake || awake.released)) acquire();
}

/** Keeps the screen on while the workout is on screen: a rest is often longer than auto-lock. */
export function keepAwake() {
	if (wanted) return;
	wanted = true;
	acquire();
	document.addEventListener('visibilitychange', onvisibility);
}

export function letSleep() {
	wanted = false;
	document.removeEventListener('visibilitychange', onvisibility);
	awake?.release().catch(() => {});
	awake = undefined;
}

type Lockable = ScreenOrientation & { lock?: (orientation: string) => Promise<void>; unlock?: () => void };

/**
 * Asks for landscape, which the workout is laid out for. Only some browsers let a page lock it —
 * Android, full screen —; iOS never does, and the workout reads in portrait as well.
 */
export function preferLandscape() {
	(screen.orientation as Lockable | undefined)?.lock?.('landscape').catch(() => {});
}

export function releaseOrientation() {
	try {
		(screen.orientation as Lockable | undefined)?.unlock?.();
	} catch {
		// Never locked.
	}
}
