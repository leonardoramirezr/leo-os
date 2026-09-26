// The microphone next to the send button. A tap opens it, a second one sends what it heard to
// Whisper, and the text goes into the message being written, to be read over before it is sent.
import { GroqError, transcribe } from './groq';
import { lang, t } from './i18n';
import { MicrophoneError, record, type Recording } from './recorder';
import { groqKey } from './settings.svelte';

export type Phase = 'idle' | 'starting' | 'recording' | 'transcribing';

/** Longer than anyone dictates a message: a microphone left open closes itself and transcribes. */
const MAX_SECONDS = 180;

/** Shorter than this is two taps in a row, not something said. */
const MIN_SECONDS = 0.6;

/** Milliseconds of sound each bar of the waveform stands for. */
const BAR_MS = 100;

/** More bars than the widest box has room for: it shows the latest ones. */
const BARS = 160;

interface Handlers {
	/** What was said, as text. Never empty. */
	onheard: (text: string) => void;
	/** Why nothing came of it, to tell the user. */
	onproblem: (message: string) => void;
}

export class Dictation {
	phase = $state<Phase>('idle');

	/** Seconds the microphone has been open. */
	seconds = $state(0);

	/** How loud each of the last stretches of sound was, from 0 to 1, oldest first. */
	levels = $state.raw<number[]>([]);

	#handlers: Handlers;
	/** The dictation under way, from the tap to the text: cancelling it aborts whatever it is waiting on. */
	#controller?: AbortController;
	#recording?: Recording;
	#openedAt = 0;
	#frame = 0;
	#barAt = 0;
	#peak = 0;

	constructor(handlers: Handlers) {
		this.#handlers = handlers;
	}

	/** The microphone button: opens it, or closes it and transcribes what it heard. */
	toggle() {
		if (this.phase === 'idle') this.#open();
		else if (this.phase === 'recording') this.#finish();
	}

	/** Closes the microphone, or drops the transcription under way, and throws away what it heard. */
	cancel() {
		this.#controller?.abort();
		this.#controller = undefined;
		this.#recording?.cancel();
		this.#close();
		this.phase = 'idle';
	}

	/** iOS stops the microphone of a page sent to the background: what was said so far is transcribed. */
	interrupt() {
		if (this.phase === 'recording') this.#finish();
	}

	async #open() {
		const controller = (this.#controller = new AbortController());
		this.phase = 'starting';

		let recording: Recording;
		try {
			recording = await record();
		} catch (error) {
			if (this.#controller !== controller) return;
			this.#controller = undefined;
			this.phase = 'idle';
			this.#handlers.onproblem(describe(error));
			return;
		}

		// Cancelled while the microphone was opening.
		if (this.#controller !== controller) {
			recording.cancel();
			return;
		}

		this.#recording = recording;
		this.seconds = 0;
		this.levels = new Array(BARS).fill(0);
		this.#peak = 0;
		this.#openedAt = this.#barAt = performance.now();
		this.phase = 'recording';
		this.#frame = requestAnimationFrame(this.#tick);
	}

	/** Once a frame while recording: the clock, the waveform and the time limit. */
	#tick = () => {
		if (this.phase !== 'recording' || !this.#recording) return;

		const now = performance.now();
		const elapsed = (now - this.#openedAt) / 1000;
		this.seconds = Math.floor(elapsed);
		// A bar keeps the loudest frame of its stretch, so no syllable falls between two of them.
		this.#peak = Math.max(this.#peak, this.#recording.level());
		if (now - this.#barAt >= BAR_MS) {
			this.levels = [...this.levels.slice(1), this.#peak];
			this.#peak = 0;
			this.#barAt = now;
		}

		if (elapsed >= MAX_SECONDS) this.#finish();
		else this.#frame = requestAnimationFrame(this.#tick);
	};

	#close() {
		cancelAnimationFrame(this.#frame);
		this.#recording = undefined;
	}

	async #finish() {
		const recording = this.#recording;
		const controller = this.#controller;
		if (this.phase !== 'recording' || !recording || !controller) return;

		const seconds = (performance.now() - this.#openedAt) / 1000;
		this.#close();
		this.phase = 'transcribing';

		let heard = '';
		let problem = '';
		try {
			const audio = await recording.stop();
			if (seconds >= MIN_SECONDS && audio.size > 0) {
				heard = await transcribe(groqKey.value, audio, lang, controller.signal);
			}
			if (!heard) problem = t.nothingHeard;
		} catch (error) {
			problem = describe(error);
		}

		// Cancelled on the way, which already put everything back: another one may even have begun.
		if (this.#controller !== controller) return;
		this.#controller = undefined;
		this.phase = 'idle';
		if (problem) this.#handlers.onproblem(problem);
		else this.#handlers.onheard(heard);
	}
}

/** What to tell the user when dictating fails. */
function describe(error: unknown): string {
	if (error instanceof MicrophoneError) return error.message;
	if (!(error instanceof GroqError)) {
		return error instanceof Error && error.message ? error.message : t.failed;
	}

	if (error.status === 0) return t.groqNetworkError;
	if (error.status === 401) return t.groqKeyRejected;
	if (error.status === 429) return t.groqRateLimited;
	if (error.status === 413) return t.recordingTooLong;
	return error.message;
}
