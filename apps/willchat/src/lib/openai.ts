// Minimal client for the parts of the OpenAI API that WillChat uses, called directly from the browser.

const API_URL = 'https://api.openai.com/v1';

export type InputContent =
	| { type: 'input_image'; image_url: string }
	| { type: 'input_text'; text: string }
	/** A document, a PDF for instance, as a data URL. */
	| { type: 'input_file'; filename: string; file_data: string };

export type InputItem =
	| { role: 'system' | 'assistant'; content: string }
	| { role: 'user'; content: InputContent[] };

export interface ResponseRequest {
	stream: false;
	/** Runs the response asynchronously so it can be polled: a long request would time out on iOS Safari. */
	background: true;
	model: string;
	tools: { type: 'image_generation'; model: string }[];
	input: InputItem[];
}

export interface OutputItem {
	type: string;
	id?: string;
	status?: string;
	/** `message` items */
	content?: { type: string; text?: string; refusal?: string }[];
	/** `image_generation_call` items: the base64-encoded image */
	result?: string | null;
}

export interface OpenAIResponse {
	id: string;
	status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'incomplete';
	output?: OutputItem[];
	error?: { code?: string; message?: string } | null;
	incomplete_details?: { reason?: string } | null;
}

export class OpenAIError extends Error {
	/** `status` is 0 when the API couldn't be reached. */
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string
	) {
		super(message);
		this.name = 'OpenAIError';
	}

	/** Whether repeating the same call may succeed. */
	get transient() {
		return (
			this.status === 0 || this.status >= 500 || (this.status === 429 && this.code !== 'insufficient_quota')
		);
	}
}

interface CallOptions {
	method?: 'GET' | 'POST';
	body?: unknown;
	signal?: AbortSignal;
	/** Milliseconds to wait for the response headers. */
	timeout?: number;
}

async function call<T>(apiKey: string, path: string, options: CallOptions = {}): Promise<T> {
	const { method = 'GET', body, signal, timeout } = options;
	signal?.throwIfAborted();

	const controller = new AbortController();
	const abort = () => controller.abort(signal?.reason);
	signal?.addEventListener('abort', abort);
	const timer = timeout ? setTimeout(() => controller.abort(), timeout) : undefined;

	try {
		let response: Response;
		try {
			response = await fetch(`${API_URL}${path}`, {
				method,
				headers: {
					Authorization: `Bearer ${apiKey}`,
					...(body === undefined ? {} : { 'Content-Type': 'application/json' })
				},
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: controller.signal
			});
		} finally {
			clearTimeout(timer);
		}

		const data = await response.json().catch(() => undefined);
		if (!response.ok) {
			throw new OpenAIError(
				data?.error?.message || `${response.status} ${response.statusText}`.trim(),
				response.status,
				data?.error?.code ?? undefined
			);
		}
		if (data === undefined) throw new OpenAIError('Invalid response', 0);
		return data as T;
	} catch (error) {
		if (signal?.aborted || error instanceof OpenAIError) throw error;
		throw new OpenAIError('Network error', 0);
	} finally {
		signal?.removeEventListener('abort', abort);
	}
}

export function listModels(apiKey: string) {
	return call<{ data: { id: string; created: number }[] }>(apiKey, '/models', { timeout: 20_000 });
}

export function createResponse(apiKey: string, request: ResponseRequest, signal?: AbortSignal) {
	return call<OpenAIResponse>(apiKey, '/responses', { method: 'POST', body: request, signal });
}

export function retrieveResponse(apiKey: string, id: string, signal?: AbortSignal) {
	return call<OpenAIResponse>(apiKey, `/responses/${encodeURIComponent(id)}`, { signal, timeout: 20_000 });
}

export function cancelResponse(apiKey: string, id: string) {
	return call<OpenAIResponse>(apiKey, `/responses/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

/** Extracts the reply text and the generated images (as data URLs) from a response. */
export function readOutput(response: OpenAIResponse) {
	const texts: string[] = [];
	const images: string[] = [];
	let generating = false;

	for (const item of response.output ?? []) {
		if (item.type === 'message') {
			for (const part of item.content ?? []) {
				const text = part.type === 'refusal' ? part.refusal : part.text;
				if (text) texts.push(text);
			}
		} else if (item.type === 'image_generation_call') {
			if (item.result) images.push(`data:${imageType(item.result)};base64,${item.result}`);
			else generating = true;
		}
	}

	return { text: texts.join('\n\n'), images, generating };
}

function imageType(base64: string) {
	if (base64.startsWith('/9j/')) return 'image/jpeg';
	if (base64.startsWith('UklGR')) return 'image/webp';
	return 'image/png';
}
