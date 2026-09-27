// The one way into the list: the microphone. A tap opens it, a second tap sends what it heard to
// Whisper, and the text goes on to the chat model, whose decision is applied to the list.
import { decide } from './commands';
import { GroqError, transcribe } from './groq';
import { list } from './list.svelte';
import { MicrophoneError, record, type Recording } from './recorder';
import { apiKey } from './settings.svelte';

export type Phase = 'idle' | 'starting' | 'recording' | 'transcribing' | 'thinking';

/** Longer than anyone dictates a list: a microphone left open closes itself and sends what it heard. */
const MAX_SECONDS = 180;

/** Shorter than this is two taps in a row, not something said. */
const MIN_SECONDS = 0.6;

const NOTHING_HEARD = 'No se oyó nada.';

/** Takes back the last change and says so. */
function takeBack(): string {
	return list.undo() ? 'Deshice el último cambio.' : 'No hay nada que deshacer.';
}

class Voice {
	phase = $state<Phase>('idle');

	/** Seconds the microphone has been open. */
	seconds = $state(0);

	/** How loud the microphone is right now, from 0 to 1. */
	level = $state(0);

	/** What Whisper heard the last time. */
	heard = $state('');

	/** What the model says it did, or why it did nothing. */
	reply = $state('');

	error = $state('');

	/** The error is Groq turning the key down: it comes with a way to change it. */
	keyRefused = $state(false);

	#recording?: Recording;
	#openedAt = 0;
	#frame = 0;

	get busy(): boolean {
		return this.phase === 'starting' || this.phase === 'transcribing' || this.phase === 'thinking';
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

	/** Drops the key, which sends the app back to asking for one, and the error that came with it. */
	changeKey() {
		this.error = '';
		this.keyRefused = false;
		apiKey.value = '';
	}

	undo() {
		if (this.busy || this.phase === 'recording') return;

		this.heard = '';
		this.error = '';
		this.reply = takeBack();
	}

	async #open() {
		this.phase = 'starting';
		this.error = '';
		this.keyRefused = false;

		try {
			this.#recording = await record();
		} catch (error) {
			this.phase = 'idle';
			this.error = error instanceof MicrophoneError ? error.message : 'No se pudo abrir el micrófono.';
			return;
		}

		this.heard = '';
		this.reply = '';
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
			if (seconds < MIN_SECONDS || audio.size === 0) {
				this.reply = NOTHING_HEARD;
				return;
			}

			const key = apiKey.value;
			this.heard = await transcribe(key, audio);
			if (!this.heard) {
				this.reply = NOTHING_HEARD;
				return;
			}

			this.phase = 'thinking';
			// Numbered as it is on screen right now, which is the list the model's numbers point at.
			const decision = await decide(key, $state.snapshot(list.items), this.heard);

			if (decision.undo) {
				this.reply = takeBack();
			} else {
				const changed = list.apply(decision.changes);
				// Pointing at items that are not there, its reply would claim what never happened.
				if (!changed && decision.missed) this.reply = 'No encontré en la lista lo que mencionaste.';
				else this.reply = decision.reply || (changed ? 'Listo.' : 'No cambié nada.');
			}
		} catch (error) {
			this.#fail(error);
		} finally {
			this.phase = 'idle';
		}
	}

	#fail(error: unknown) {
		if (!(error instanceof GroqError)) {
			this.error = error instanceof Error && error.message ? error.message : 'Algo salió mal.';
			return;
		}

		this.keyRefused = error.status === 401;
		if (error.status === 0) {
			this.error = 'No se pudo conectar con Groq. Revisa tu conexión e inténtalo de nuevo.';
		} else if (error.status === 401) {
			this.error = 'Groq rechazó la API key.';
		} else if (error.status === 429) {
			this.error = 'Groq pide esperar: tu API key llegó a su límite de uso por ahora.';
		} else if (error.status === 413) {
			this.error = 'La grabación es demasiado larga.';
		} else {
			this.error = error.message;
		}
	}
}

export const voice = new Voice();
