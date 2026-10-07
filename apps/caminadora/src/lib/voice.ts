// The voice that says each minute and each change of speed: the browser's own speech synthesis, in
// Spanish.
//
// iOS only lets a page speak once it has spoken during a tap; until then every utterance is dropped
// without a word. So the taps that lead to a program running call `unlock`, and starting one says
// its first speed right there, inside the tap.

/** Mexican Spanish first, then the Spanish closest to it. */
const ACCENTS = ['es-mx', 'es-us', 'es-419'];

let unlocked = false;

/** Held on to until said: Chrome may drop an utterance nothing points to before it gets to it. */
const queued = new Set<SpeechSynthesisUtterance>();

function synthesis(): SpeechSynthesis | undefined {
	return typeof speechSynthesis === 'undefined' ? undefined : speechSynthesis;
}

function langOf(voice: SpeechSynthesisVoice): string {
	return voice.lang.replace('_', '-').toLowerCase();
}

/**
 * The device's own Spanish voice, the Mexican one if it has it. One that speaks from a server —
 * Chrome's «Google» voices — only when the device has none: what it says would be sent there.
 */
function pick(): SpeechSynthesisVoice | undefined {
	const spanish = (synthesis()?.getVoices() ?? []).filter((voice) => langOf(voice).startsWith('es'));
	const rank = (voice: SpeechSynthesisVoice) => {
		const accent = ACCENTS.indexOf(langOf(voice));
		return (voice.localService ? 0 : 10) + (accent === -1 ? ACCENTS.length : accent);
	};
	return spanish.toSorted((a, b) => rank(a) - rank(b))[0];
}

function speak(utterance: SpeechSynthesisUtterance) {
	const synth = synthesis();
	if (!synth) return;

	queued.add(utterance);
	utterance.onend = utterance.onerror = () => queued.delete(utterance);
	// Chrome may leave the synthesis paused after the page spent a while in the background.
	synth.resume();
	synth.speak(utterance);
}

export function say(text: string) {
	if (!synthesis()) return;

	const utterance = new SpeechSynthesisUtterance(text);
	const voice = pick();
	// Without a voice of its own, the language still steers the browser to one that speaks it.
	utterance.lang = voice?.lang ?? 'es-MX';
	if (voice) utterance.voice = voice;
	speak(utterance);
}

/** Lets the voice speak from then on. Called during a tap; after the first one it does nothing. */
export function unlock() {
	if (unlocked || !synthesis()) return;

	unlocked = true;
	const silence = new SpeechSynthesisUtterance('');
	silence.volume = 0;
	speak(silence);
}

/** Silences what is being said and whatever was waiting its turn. */
export function hush() {
	const synth = synthesis();
	if (synth?.speaking || synth?.pending) synth.cancel();
}

// Some browsers only start loading their voices once asked for them.
synthesis()?.getVoices();
