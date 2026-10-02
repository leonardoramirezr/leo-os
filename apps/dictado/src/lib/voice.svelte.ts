// The two microphones, and «Mejorar». One microphone dictates: what is said goes to Whisper and
// lands at the end of the text, rewritten first by the chat model when «Mejorar texto» is on. The
// other, «Editar», listens for an instruction instead, which the chat model carries out on the
// whole text. «Mejorar» needs no microphone: the chat model rewrites the whole text, there and then,
// the way «Mejorar texto» rewrites a dictation.
import { draft } from './draft.svelte';
import { GroqError, transcribe } from './groq';
import { MicrophoneError, record, type Recording } from './recorder';
import * as rewrite from './rewrite';
import { apiKey, chatModel, improving, language, prompt, transcriptionModel } from './settings.svelte';

export type Mode = 'dictate' | 'edit';

export type Phase = 'idle' | 'starting' | 'recording' | 'transcribing' | 'improving' | 'editing';

/** Longer than anyone dictates in one go: a microphone left open closes itself and goes on with what it heard. */
const MAX_SECONDS = 600;

/** Shorter than this is two taps in a row, not something said. */
const MIN_SECONDS = 0.6;

const NOTHING_HEARD = 'No se oyó nada.';

/**
 * What the changes view says made an improvement: the switch, by its name. «Mejorar» follows the
 * same instructions, and goes by the same name.
 */
const IMPROVING = 'Mejorar texto';

/** A line that is an item of a list: «- Leche», «• Leche», «1. Leche», «2) Leche». */
const ITEM = /^\s*([-*•]|\d+[.)])\s/;

/**
 * `text` with what was just dictated at its end. A stretch of speech follows on from the text; one
 * that comes in several lines — paragraphs, a list — starts a paragraph of its own, and so does
 * anything added to a text that already has them, except the next item of a list, which goes on the
 * next line. A text left on a new line by hand is added to right there.
 */
function append(text: string, addition: string): string {
	if (!text.trim()) return addition;
	if (/\n[ \t]*$/.test(text)) return text.replace(/[ \t]+$/, '') + addition;

	const before = text.trimEnd();
	if (!before.includes('\n') && !addition.includes('\n')) return `${before} ${addition}`;

	const last = before.slice(before.lastIndexOf('\n') + 1);
	return before + (ITEM.test(last) && ITEM.test(addition) ? '\n' : '\n\n') + addition;
}

class Voice {
	phase = $state<Phase>('idle');

	/** What the last tap asked for, and so what is under way while busy: a microphone, or «Mejorar». */
	mode = $state<Mode | 'improve'>('dictate');

	/** Seconds the microphone has been open. */
	seconds = $state(0);

	/** How loud the microphone is right now, from 0 to 1. */
	level = $state(0);

	/** What «Editar» was told the last time. */
	heard = $state('');

	/** How it went, when there is something to say. */
	reply = $state('');

	error = $state('');

	/** The error is Groq turning the key down: it comes with a way to change it. */
	keyRefused = $state(false);

	/** Goes up every time a dictation lands at the end of the text, for the screen to bring it into sight. */
	landed = $state(0);

	#recording?: Recording;
	#openedAt = 0;
	#frame = 0;

	/** Between a tap and the text changing: nothing else may change it meanwhile. */
	get busy(): boolean {
		return this.phase !== 'idle' && this.phase !== 'recording';
	}

	/** Either microphone: opens it for `mode`, or closes it and goes on with what it heard. */
	toggle(mode: Mode) {
		if (this.phase === 'idle') this.#open(mode);
		else if (this.phase === 'recording' && this.mode === mode) this.#finish();
	}

	/** Closes the microphone and throws away what it heard. */
	cancel() {
		if (this.phase !== 'recording') return;

		this.#recording?.cancel();
		this.#close();
		this.phase = 'idle';
	}

	/** iOS stops the microphone of an app sent to the background: what was said so far goes on. */
	interrupt() {
		if (this.phase === 'recording') this.#finish();
	}

	/**
	 * «Mejorar»: the whole text, rewritten the way the instructions of «Mejorar texto» say, whether
	 * the switch is on or not. What it was stays one undo away.
	 */
	async improve() {
		draft.settle();
		const before = draft.text;
		if (this.phase !== 'idle' || !before.trim()) return;

		this.forget();
		this.mode = 'improve';
		this.phase = 'improving';
		try {
			const after = await rewrite.improve(apiKey.value, chatModel.value, prompt.value, before);
			if (!after) throw new Error('Groq no devolvió el texto. Inténtalo de nuevo.');

			if (after === before.trim()) this.reply = 'El texto quedó igual.';
			else draft.set(after, IMPROVING);
		} catch (error) {
			this.#fail(error);
		} finally {
			this.phase = 'idle';
		}
	}

	/**
	 * What the last dictation, edit or improvement said no longer applies: the text was changed by
	 * other means.
	 */
	forget() {
		if (this.phase !== 'idle') return;

		this.heard = '';
		this.reply = '';
		this.error = '';
		this.keyRefused = false;
	}

	/** Drops the key, which sends the app back to asking for one, and the error that came with it. */
	changeKey() {
		this.error = '';
		this.keyRefused = false;
		apiKey.value = '';
	}

	async #open(mode: Mode) {
		this.phase = 'starting';
		this.mode = mode;
		this.heard = '';
		this.reply = '';
		this.error = '';
		this.keyRefused = false;

		try {
			this.#recording = await record();
		} catch (error) {
			this.phase = 'idle';
			this.error = error instanceof MicrophoneError ? error.message : 'No se pudo abrir el micrófono.';
			return;
		}

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
		if (elapsed >= MAX_SECONDS) this.#finish();
		else this.#frame = requestAnimationFrame(this.#tick);
	};

	#close() {
		cancelAnimationFrame(this.#frame);
		this.#recording = undefined;
		this.level = 0;
	}

	async #finish() {
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
			const heard = await transcribe(key, audio, {
				model: transcriptionModel.value,
				language: language.value
			});
			if (!heard) this.reply = NOTHING_HEARD;
			else if (this.mode === 'edit') await this.#edit(key, heard);
			else await this.#dictate(key, heard);
		} catch (error) {
			this.#fail(error);
		} finally {
			this.phase = 'idle';
		}
	}

	async #dictate(key: string, heard: string) {
		const before = draft.text;
		// As it was heard, first: it is on screen while it is improved, and stays if that fails. Undo
		// goes back to it.
		draft.set(append(before, heard));
		this.landed++;
		if (!improving.value) return;

		this.phase = 'improving';
		const improved = await rewrite.improve(key, chatModel.value, prompt.value, heard, before);
		if (!improved) return;

		draft.set(append(before, improved), IMPROVING);
		this.landed++;
	}

	async #edit(key: string, heard: string) {
		this.heard = heard;
		this.phase = 'editing';

		const before = draft.text;
		const after = await rewrite.edit(key, chatModel.value, before, heard);
		if (!after) throw new Error('Groq no devolvió el texto. Inténtalo de nuevo.');

		if (after === before.trim()) {
			this.reply = 'El texto quedó igual.';
		} else {
			draft.set(after, heard);
			this.reply = 'Listo.';
		}
	}

	#fail(error: unknown) {
		const message = this.#describe(error);
		// What was being improved is on screen as it was: a dictation, as it was heard.
		this.error = this.phase === 'improving' ? `${message} El texto quedó sin mejorar.` : message;
	}

	#describe(error: unknown): string {
		if (!(error instanceof GroqError)) {
			return error instanceof Error && error.message ? error.message : 'Algo salió mal.';
		}

		this.keyRefused = error.status === 401;
		if (error.status === 0) return 'No se pudo conectar con Groq. Revisa tu conexión e inténtalo de nuevo.';
		if (error.status === 401) return 'Groq rechazó la API key.';
		if (error.status === 429) return 'Groq pide esperar: tu API key llegó a su límite de uso por ahora.';
		if (error.status === 413) {
			return this.phase === 'transcribing' ? 'La grabación es demasiado larga.' : 'El texto es demasiado largo.';
		}
		// Groq retires models: the one picked in the settings may be gone.
		if (error.status === 404 || error.code === 'model_not_found' || error.code === 'model_decommissioned') {
			return 'Groq ya no tiene el modelo elegido. Elige otro en Ajustes.';
		}
		return error.message;
	}
}

export const voice = new Voice();
