import { session } from '@leo-os/shared';
import { createRequest, type AssistantMessage, type Message } from './conversation';
import * as db from './db';
import { t } from './i18n';
import { cancelResponse, createResponse, type OpenAIResponse } from './openai';
import { fail, finish, pendingMessage, poll, uid } from './responses';
import { apiKey, imageModel, textModel } from './settings.svelte';

// The conversation is full of images, so it stays in this browser's IndexedDB. The key carries
// the account: two people on the same phone do not read each other's chat.
const STORAGE_KEY = 'conversation';

class Chat {
	messages = $state<Message[]>([]);
	loaded = $state(false);

	#controller?: AbortController;
	#loading?: Promise<void>;
	#saving: Promise<unknown> = Promise.resolve();

	get #key() {
		return `${STORAGE_KEY}:${session.account?.id ?? ''}`;
	}

	/** The last message, while its response is in progress. */
	get pending() {
		const last = this.messages.at(-1);
		return last?.role === 'assistant' && last.status === 'pending' ? last : undefined;
	}

	/** Restores the saved conversation and resumes a response that was still running. */
	load() {
		return (this.#loading ??= this.#restore());
	}

	async send(text: string, images: string[]) {
		if (!this.loaded || this.pending) return;
		this.messages.push({ id: uid(), role: 'user', text, images });
		await this.#respond();
	}

	async retry() {
		const last = this.messages.at(-1);
		if (last?.role !== 'assistant' || last.status !== 'failed') return;

		if (last.error?.resumable) {
			last.status = 'pending';
			last.error = undefined;
			await this.#follow(last);
		} else {
			this.messages.pop();
			await this.#respond();
		}
	}

	stop() {
		const message = this.pending;
		if (!message) return;

		message.status = 'cancelled';
		message.phase = undefined;
		this.#controller?.abort();
		if (message.responseId) cancelResponse(apiKey.value, message.responseId).catch(() => {});
		this.#save();
	}

	clear() {
		this.stop();
		this.messages = [];
		this.#save();
	}

	async #restore() {
		const saved = await db.get<Message[]>(this.#key).catch(() => undefined);
		if (saved) this.messages = saved;
		this.loaded = true;

		const pending = this.pending;
		if (pending?.responseId) this.#follow(pending);
		else if (pending) this.#fail(pending, new Error(t.interrupted));
	}

	async #respond() {
		const history = $state.snapshot(this.messages);
		this.messages.push(pendingMessage());
		const message = this.messages.at(-1) as AssistantMessage;
		this.#save();

		const { signal } = this.#newController();
		try {
			const request = createRequest(history, textModel.value, imageModel.value);
			const response = await createResponse(apiKey.value, request, signal);
			message.responseId = response.id;
			this.#save();
			await this.#poll(message, signal, response);
		} catch (error) {
			this.#fail(message, error);
		}
	}

	async #follow(message: AssistantMessage) {
		const { signal } = this.#newController();
		try {
			await this.#poll(message, signal);
		} catch (error) {
			this.#fail(message, error);
		}
	}

	#newController() {
		this.#controller?.abort();
		return (this.#controller = new AbortController());
	}

	async #poll(message: AssistantMessage, signal: AbortSignal, response?: OpenAIResponse) {
		const finished = await poll(apiKey.value, message, signal, response);
		if (await finish(message, finished)) this.#save();
	}

	#fail(message: AssistantMessage, error: unknown) {
		if (fail(message, error)) this.#save();
	}

	#save() {
		const messages = $state.snapshot(this.messages);
		this.#saving = this.#saving.then(() => db.set(this.#key, messages)).catch(() => {});
	}
}

export const chat = new Chat();
