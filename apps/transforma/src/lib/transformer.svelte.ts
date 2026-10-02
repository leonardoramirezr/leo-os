// Carrying a prompt out on the text: one at a time, with the text left alone meanwhile.
import { draft } from './draft.svelte';
import { describe, GroqError } from './groq';
import { titleOf, type Prompt } from './prompts.svelte';
import { apiKey, model } from './settings.svelte';
import { transform } from './transform';

class Transformer {
	/** The prompt being carried out, by id; '' while none is. */
	running = $state('');

	error = $state('');

	/** The error is Groq turning the key down: it comes with a way to change it. */
	keyRefused = $state(false);

	/** How the last one went, when the text does not show it. */
	notice = $state('');

	get busy(): boolean {
		return this.running !== '';
	}

	/** Rewrites the text the way `prompt` says. What it was stays one undo away. */
	async run(prompt: Prompt) {
		draft.settle();
		const before = draft.text;
		if (this.busy || !before.trim()) return;

		this.forget();
		this.running = prompt.id;
		try {
			const after = await transform(apiKey.value, model.value, prompt.instructions, before);
			if (!after) throw new Error('Groq no devolvió el texto. Inténtalo de nuevo.');

			// Changed on another device meanwhile: the answer is about a text that is no longer there.
			if (draft.text !== before) {
				this.error = 'El texto cambió mientras se transformaba. Vuelve a intentarlo.';
			} else if (after === before.trim()) {
				this.notice = 'El texto quedó igual.';
			} else {
				draft.set(after, titleOf(prompt));
			}
		} catch (error) {
			this.keyRefused = error instanceof GroqError && error.status === 401;
			this.error = describe(error);
		} finally {
			this.running = '';
		}
	}

	/** What the last one said no longer applies: the text changed by other means. */
	forget() {
		this.error = '';
		this.keyRefused = false;
		this.notice = '';
	}

	/** Drops the key, which sends the app back to asking for one, and the error that came with it. */
	changeKey() {
		this.forget();
		apiKey.value = '';
	}
}

export const transformer = new Transformer();
