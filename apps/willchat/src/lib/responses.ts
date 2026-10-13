// What the chat and the mini apps share: a background response followed until it ends, and its
// output written into the message that shows it.
import type { AssistantMessage } from './conversation';
import { t } from './i18n';
import { prepareImage } from './images';
import { OpenAIError, readOutput, retrieveResponse, type OpenAIResponse } from './openai';

const POLL_INTERVAL = 2_000;
/** Consecutive connection failures tolerated while polling, e.g. while the phone is locked. */
const MAX_POLL_FAILURES = 8;

/**
 * Polls the message's response until it is no longer running, keeping `phase` up to date, and
 * gives it back. `response` is the one `createResponse` answered, when there is one.
 */
export async function poll(
	apiKey: string,
	message: AssistantMessage,
	signal: AbortSignal,
	response?: OpenAIResponse
): Promise<OpenAIResponse> {
	let failures = 0;

	while (!response || response.status === 'queued' || response.status === 'in_progress') {
		if (response) message.phase = isGeneratingImage(response) ? 'image' : 'thinking';
		if (response || failures) await sleep(POLL_INTERVAL, signal);

		try {
			response = await retrieveResponse(apiKey, message.responseId!, signal);
			failures = 0;
		} catch (error) {
			if (!(error instanceof OpenAIError && error.transient) || ++failures >= MAX_POLL_FAILURES) {
				throw error;
			}
		}
	}

	return response;
}

/** Writes a finished response into its message. False when the message stopped waiting for it. */
export async function finish(message: AssistantMessage, response: OpenAIResponse): Promise<boolean> {
	const { text, images } = readOutput(response);
	const generated = await Promise.all(
		images.map(async (url) => ({ url, input: await prepareImage(url).catch(() => url) }))
	);
	if (message.status !== 'pending') return false;

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
	return true;
}

/** Marks a message as failed with what went wrong. False when it was no longer waiting. */
export function fail(message: AssistantMessage, error: unknown): boolean {
	if (message.status !== 'pending') return false;

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
	return true;
}

/** A message waiting for its response, with nothing in it yet. */
export function pendingMessage(): AssistantMessage {
	return {
		id: uid(),
		role: 'assistant',
		status: 'pending',
		phase: 'thinking',
		text: '',
		images: [],
		startedAt: Date.now()
	};
}

export function uid() {
	return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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
