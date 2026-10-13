// Running a mini app: what the user answered and picked, and the one result it gives — no
// conversation follows it. Each mini app keeps its last run in this browser's IndexedDB, as the chat
// keeps its conversation, under a key that carries the account. A run goes on in the background
// while the user is elsewhere, and is picked up again after a reload.
import { session } from '@leo-os/shared';
import type { AssistantMessage } from './conversation';
import * as db from './db';
import type { PickedFile } from './files';
import { t } from './i18n';
import { fill, questionsOf, type MiniApp } from './miniapps.svelte';
import {
	cancelResponse,
	createResponse,
	type InputContent,
	type OpenAIResponse,
	type ResponseRequest
} from './openai';
import { fail, finish, pendingMessage, poll } from './responses';
import { apiKey, imageModel, textModel } from './settings.svelte';

export interface Run {
	/** By question. */
	answers: Record<string, string>;
	/** By the id of the input they were picked for. */
	files: Record<string, PickedFile[]>;
	result?: AssistantMessage;
}

/** Typing saves this long after the last key, rather than writing every image again on each one. */
const SAVE_DELAY = 500;

class Runs {
	#runs = $state<Record<string, Run>>({});
	#loading = new Map<string, Promise<void>>();
	#controllers = new Map<string, AbortController>();
	#timers = new Map<string, ReturnType<typeof setTimeout>>();
	#saving: Promise<unknown> = Promise.resolve();

	#key(id: string) {
		return `mini-app:${session.account?.id ?? ''}:${id}`;
	}

	/** The mini app's run, once `open` has read it. */
	get(id: string): Run | undefined {
		return this.#runs[id];
	}

	/** Reads the last run, and resumes its response if it was still running. */
	open(id: string) {
		let loading = this.#loading.get(id);
		if (!loading) {
			loading = this.#restore(id);
			this.#loading.set(id, loading);
		}
		return loading;
	}

	async send(app: MiniApp) {
		const run = this.#runs[app.id];
		if (!run || run.result?.status === 'pending') return;
		if (Object.values(run.files).some((files) => files.some((file) => file.reading))) return;

		run.result = pendingMessage();
		const result = run.result;
		this.#save(app.id);

		const { signal } = this.#newController(app.id);
		try {
			const request = createRequest(app, $state.snapshot(run) as Run, textModel.value, imageModel.value);
			const response = await createResponse(apiKey.value, request, signal);
			result.responseId = response.id;
			this.#save(app.id);
			await this.#poll(app.id, result, signal, response);
		} catch (error) {
			this.#fail(app.id, result, error);
		}
	}

	async retry(app: MiniApp) {
		const result = this.#runs[app.id]?.result;
		if (result?.status !== 'failed') return;

		if (result.error?.resumable) {
			result.status = 'pending';
			result.error = undefined;
			await this.#follow(app.id, result);
		} else {
			await this.send(app);
		}
	}

	stop(id: string) {
		const result = this.#runs[id]?.result;
		if (result?.status !== 'pending') return;

		result.status = 'cancelled';
		result.phase = undefined;
		this.#controllers.get(id)?.abort();
		if (result.responseId) cancelResponse(apiKey.value, result.responseId).catch(() => {});
		this.#save(id);
	}

	/** Saves what was answered or picked, a moment after the last change. */
	changed(id: string) {
		clearTimeout(this.#timers.get(id));
		this.#timers.set(
			id,
			setTimeout(() => this.#save(id), SAVE_DELAY)
		);
	}

	/** Empties the answers, the files and the result, to start again. */
	clear(id: string) {
		this.stop(id);
		this.#runs[id] = { answers: {}, files: {} };
		this.#save(id);
	}

	/** Drops what a deleted mini app left on the device. */
	forget(id: string) {
		this.stop(id);
		clearTimeout(this.#timers.get(id));
		delete this.#runs[id];
		this.#loading.delete(id);
		const key = this.#key(id);
		this.#saving = this.#saving.then(() => db.del(key)).catch(() => {});
	}

	async #restore(id: string) {
		const saved = await db.get<Run>(this.#key(id)).catch(() => undefined);
		this.#runs[id] = { answers: saved?.answers ?? {}, files: saved?.files ?? {}, result: saved?.result };

		const result = this.#runs[id].result;
		if (result?.status !== 'pending') return;
		if (result.responseId) this.#follow(id, result);
		else this.#fail(id, result, new Error(t.interrupted));
	}

	async #follow(id: string, result: AssistantMessage) {
		const { signal } = this.#newController(id);
		try {
			await this.#poll(id, result, signal);
		} catch (error) {
			this.#fail(id, result, error);
		}
	}

	#newController(id: string) {
		this.#controllers.get(id)?.abort();
		const controller = new AbortController();
		this.#controllers.set(id, controller);
		return controller;
	}

	async #poll(id: string, result: AssistantMessage, signal: AbortSignal, response?: OpenAIResponse) {
		const finished = await poll(apiKey.value, result, signal, response);
		if (await finish(result, finished)) this.#save(id);
	}

	#fail(id: string, result: AssistantMessage, error: unknown) {
		if (fail(result, error)) this.#save(id);
	}

	#save(id: string) {
		clearTimeout(this.#timers.get(id));
		const run = this.#runs[id];
		if (!run) return;

		const snapshot = $state.snapshot(run) as Run;
		// A file still being read is picked again next time rather than kept half done.
		for (const [input, files] of Object.entries(snapshot.files)) {
			snapshot.files[input] = files.filter((file) => !file.reading);
		}
		const key = this.#key(id);
		this.#saving = this.#saving.then(() => db.set(key, snapshot)).catch(() => {});
	}
}

export const runs = new Runs();

/**
 * The mini app's prompt, with the answers in it, is what the model is told to do; the files follow
 * in the user's message, each after the title of the field it was picked in.
 */
function createRequest(app: MiniApp, run: Run, model: string, imageModel: string): ResponseRequest {
	const answers = Object.fromEntries(questionsOf(app.prompt).map((question) => [question, run.answers[question] ?? '']));
	const content: InputContent[] = [];

	for (const input of app.inputs) {
		const files = run.files[input.id] ?? [];
		if (!files.length) continue;

		const title = input.title.trim();
		if (title) content.push({ type: 'input_text', text: `${title}:` });
		for (const file of files) {
			if (file.type.startsWith('image/')) {
				content.push({ type: 'input_image', image_url: file.url });
			} else if (file.text !== undefined) {
				content.push({ type: 'input_text', text: `${file.name}:\n\n${file.text}` });
			} else {
				content.push({ type: 'input_file', filename: file.name, file_data: file.url });
			}
		}
	}

	if (!content.length) content.push({ type: 'input_text', text: 'Go ahead.' });

	return {
		stream: false,
		background: true,
		model,
		tools: [{ type: 'image_generation', model: imageModel }],
		input: [
			{ role: 'system', content: `${systemPrompt(new Date())}\n\n${fill(app.prompt, answers)}` },
			{ role: 'user', content }
		]
	};
}

function systemPrompt(date: Date) {
	const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
	const month = date.toLocaleDateString('en-US', { month: 'long' });
	const today = `${weekday}, ${date.getDate()} ${month} ${date.getFullYear()}`;

	return (
		'You are WillChat, running a mini app: a task the user set up once and runs with new inputs. ' +
		'There is no conversation: reply with the finished result only, never with questions or offers to continue. ' +
		'The instructions below are the task. Wherever the user was asked something, the question appears between ' +
		'triple brackets, like [[[question]]], and the user’s answer is written on the lines right after it; ' +
		'a question with nothing after it was left unanswered. ' +
		'Files and images the user picked come in their message, each after the title of the field it was picked in. ' +
		'Reply in the language of the instructions, unless they ask for another. ' +
		'Use Markdown when it improves readability. ' +
		`Current date: ${today}. ` +
		'You can create and edit images with your image generation tool: use it whenever the task asks for an image. ' +
		'Generated images are shown to the user automatically: never include links or Markdown images for them.\n\n' +
		'Instructions:'
	);
}
