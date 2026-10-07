// Saying it rather than typing it: a tap opens the microphone, a second one closes it and sends what
// it heard to the speech to text model picked, and the text it writes down goes to `onheard` — into
// the box where a routine is described, or the window where a change to it is asked for. One per
// screen: it closes the microphone when the screen goes.
import { describe, GroqError, transcribe } from './groq';
import { MicrophoneError, record, type Recording } from './recorder';
import { apiKey, transcriptionModel } from './settings.svelte';

export type Phase = 'idle' | 'starting' | 'recording' | 'transcribing';

/** Longer than a routine takes to describe: a microphone left open closes itself and sends what it heard. */
const MAX_SECONDS = 300;

/** Shorter than this is two taps in a row, not something said. */
const MIN_SECONDS = 0.6;

export class Dictation {
	phase = $state<Phase>('idle');

	/** Seconds the microphone has been open. */
	seconds = $state(0);

	/** How loud the microphone is right now, from 0 to 1. */
	level = $state(0);

	error = $state('');

	/** The error is Groq turning the key down: it comes with a way to change it. */
	keyRefused = $state(false);

	#onheard: (text: string) => void;
	#recording?: Recording;
	#openedAt = 0;
	#frame = 0;
	#disposed = false;

	constructor(onheard: (text: string) => void) {
		this.#onheard = onheard;
	}

	get busy(): boolean {
		return this.phase === 'starting' || this.phase === 'transcribing';
	}

	/** The microphone button: opens it, or closes it and sends what it heard. */
	toggle() {
		if (this.phase === 'idle') this.#open();
		else if (this.phase === 'recording') this.#send();
	}

	/** Closes the microphone and throws away what it heard. */
	cancel() {
		if (this.phase !== 'recording') return;

		this.#recording?.cancel();
		this.#close();
		this.phase = 'idle';
	}

	/** iOS stops the microphone of an app sent to the background: what was said so far is sent. */
	interrupt() {
		if (this.phase === 'recording') this.#send();
	}

	/** The screen is gone: the microphone closes, now or as soon as it has opened. */
	dispose() {
		this.#disposed = true;
		this.cancel();
	}

	async #open() {
		this.phase = 'starting';
		this.error = '';
		this.keyRefused = false;

		let recording: Recording;
		try {
			recording = await record();
		} catch (error) {
			this.phase = 'idle';
			this.error = error instanceof MicrophoneError ? error.message : 'No se pudo abrir el micrófono.';
			return;
		}
		if (this.#disposed) {
			recording.cancel();
			return;
		}

		this.#recording = recording;
		this.seconds = 0;
		this.#openedAt = performance.now();
		this.phase = 'recording';
		this.#frame = requestAnimationFrame(this.#tick);
	}

	/** Once a frame while recording: the clock, the level meter and the time limit. */
	#tick = () => {
		if (this.phase !== 'recording' || !this.#recording) return;

		const elapsed = (performance.now() - this.#openedAt) / 1000;
		this.seconds = Math.floor(elapsed);
		this.level = this.#recording.level();
		if (elapsed >= MAX_SECONDS) this.#send();
		else this.#frame = requestAnimationFrame(this.#tick);
	};

	#close() {
		cancelAnimationFrame(this.#frame);
		this.#recording = undefined;
		this.level = 0;
	}

	async #send() {
		const recording = this.#recording;
		if (this.phase !== 'recording' || !recording) return;

		const seconds = (performance.now() - this.#openedAt) / 1000;
		this.#close();
		this.phase = 'transcribing';

		try {
			const audio = await recording.stop();
			const heard =
				seconds < MIN_SECONDS || audio.size === 0
					? ''
					: await transcribe(apiKey.value, audio, transcriptionModel.value);
			if (heard) this.#onheard(heard);
			else this.error = 'No se oyó nada. Toca el micrófono y vuelve a intentarlo.';
		} catch (error) {
			this.error = describe(error);
			this.keyRefused = error instanceof GroqError && error.status === 401;
		} finally {
			this.phase = 'idle';
		}
	}
}
