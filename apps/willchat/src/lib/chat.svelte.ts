import { session } from '@leo-os/shared';
import { createRequest, type AssistantMessage, type Message } from './conversation';
import * as db from './db';
import { t } from './i18n';
import { prepareImage } from './images';
import {
	cancelResponse,
	createResponse,
	OpenAIError,
	readOutput,
	retrieveResponse,
	type OpenAIResponse
} from './openai';
import { apiKey, imageModel, textModel } from './settings.svelte';

// The conversation is full of images, so it stays in this browser's IndexedDB. The key carries
// the account: two people on the same phone do not read each other's chat.
const STORAGE_KEY = 'conversation';
const POLL_INTERVAL = 2_000;
/** Consecutive connection failures tolerated while polling, e.g. while the phone is locked. */
const MAX_POLL_FAILURES = 8;

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
		this.messages.push({
			id: uid(),
			role: 'assistant',
			status: 'pending',
			phase: 'thinking',
			text: '',
			images: [],
			startedAt: Date.now()
		});
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
		let failures = 0;

		while (!response || response.status === 'queued' || response.status === 'in_progress') {
			if (response) message.phase = isGeneratingImage(response) ? 'image' : 'thinking';
			if (response || failures) await sleep(POLL_INTERVAL, signal);

			try {
				response = await retrieveResponse(apiKey.value, message.responseId!, signal);
				failures = 0;
			} catch (error) {
				if (!(error instanceof OpenAIError && error.transient) || ++failures >= MAX_POLL_FAILURES) {
					throw error;
				}
			}
		}

		await this.#finish(message, response);
	}

	async #finish(message: AssistantMessage, response: OpenAIResponse) {
		const { text, images } = readOutput(response);
		const generated = await Promise.all(
			images.map(async (url) => ({ url, input: await prepareImage(url).catch(() => url) }))
		);
		if (message.status !== 'pending') return;

		message.text = text;
		message.images = generated;
		message.phase = undefined;

		if (response.status === 'failed') {
			message.status = 'failed';
			message.error = { message: response.error?.message || t.failed };
		} else if (response.status === 'cancelled') {
			message.status = 'cancelled';
		} else {
			message.status = 'done';
			if (response.status === 'incomplete') {
				const reason = response.incomplete_details?.reason;
				message.notice = reason ? `${t.incomplete} (${reason}).` : `${t.incomplete}.`;
			} else if (!text && !images.length) {
				message.notice = t.emptyResponse;
			}
		}

		this.#save();
	}

	#fail(message: AssistantMessage, error: unknown) {
		if (message.status !== 'pending') return;

		message.status = 'failed';
		message.phase = undefined;
		message.error =
			error instanceof OpenAIError
				? {
						message: error.status === 0 ? t.networkError : error.message,
						auth: error.status === 401,
						resumable: Boolean(message.responseId) && error.transient
					}
				: { message: error instanceof Error ? error.message : t.failed };
		this.#save();
	}

	#save() {
		const messages = $state.snapshot(this.messages);
		this.#saving = this.#saving.then(() => db.set(this.#key, messages)).catch(() => {});
	}
}

export const chat = new Chat();

function isGeneratingImage(response: OpenAIResponse) {
	return !!response.output?.some((item) => item.type === 'image_generation_call' && !item.result);
}

function sleep(ms: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		signal.throwIfAborted();
		const onAbort = () => {
			clearTimeout(timer);
			reject(signal.reason);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal.addEventListener('abort', onAbort, { once: true });
	});
}

function uid() {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
