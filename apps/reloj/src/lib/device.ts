// What the app asks of the phone: an alarm for the timer, which goes on until a button stops it, and a
// screen that stays on while something is to be said. Rutina's, as it is there.

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
 * Called on every tap. A page may only start making sound from a tap, and the alarm goes off when
 * nobody is touching the screen: opening the audio here, and playing a moment of silence through it
 * as iOS wants, is what lets it sound later. iOS also suspends it while the app is in the
 * background, so it is woken up again on each tap.
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
		// No sound to unlock: the alarm will be only what the screen shows, and the voice.
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

let awake: WakeLockSentinel | undefined;
let wanted = false;

async function acquire() {
	try {
		const lock = await navigator.wakeLock?.request('screen');
		// Let go of while the lock was on its way.
		if (wanted) awake = lock;
		else await lock?.release();
	} catch {
		// Refused (a page in the background, a battery saver): the screen may lock, the time goes on.
	}
}

/** The lock goes when the page is hidden, and does not come back by itself. */
function onvisibility() {
	if (wanted && document.visibilityState === 'visible' && (!awake || awake.released)) acquire();
}

/**
 * Keeps the screen on while something is to be said or to ring: a phone that locks puts the page to
 * sleep, and with it the voice and the alarm.
 */
export function keepAwake() {
	if (wanted) return;
	wanted = true;
	acquire();
	document.addEventListener('visibilitychange', onvisibility);
}

export function letSleep() {
	if (!wanted) return;
	wanted = false;
	document.removeEventListener('visibilitychange', onvisibility);
	awake?.release().catch(() => {});
	awake = undefined;
}
