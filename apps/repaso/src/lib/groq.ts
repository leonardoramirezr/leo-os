// Minimal client for the two parts of the Groq API this app uses, called straight from the browser:
// the list of models, and a chat model that writes cards. Groq answers requests from any origin, so
// there is nobody in between.

const API_URL = 'https://api.groq.com/openai/v1';

/** Writes cards until another model is picked. Groq holds it to a JSON schema (strict mode). */
export const DEFAULT_MODEL = 'openai/gpt-oss-120b';

/** What `/models` lists besides chat models: speech, voices, safety classifiers, agent systems. */
const NOT_FOR_CARDS = /whisper|tts|orpheus|playai|guard|compound/i;

export class GroqError extends Error {
	/** `status` is 0 when Groq couldn't be reached. */
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
		this.name = 'GroqError';
	}
}

interface CallOptions {
	method?: 'GET' | 'POST';
	/** Sent as JSON. */
	body?: unknown;
	/** Milliseconds to wait for the whole answer. */
	timeout: number;
}

async function call<T>(apiKey: string, path: string, { method = 'GET', body, timeout }: CallOptions) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);

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
		} catch {
			throw new GroqError('Network error', 0);
		}

		const data = await response.json().catch(() => undefined);
		if (!response.ok) {
			throw new GroqError(
				data?.error?.message || `${response.status} ${response.statusText}`.trim(),
				response.status
			);
		}
		// Cut off by the timeout halfway through the body, or not JSON at all.
		if (data === undefined) throw new GroqError('Invalid response', 0);
		return data as T;
	} finally {
		clearTimeout(timer);
	}
}

/** The chat models the key can use, in alphabetical order, which groups them by maker. */
export async function chatModels(apiKey: string): Promise<string[]> {
	const { data } = await call<{ data?: { id: string; active?: boolean }[] }>(apiKey, '/models', {
		timeout: 20_000
	});

	return (data ?? [])
		.filter((model) => model.active !== false && !NOT_FOR_CARDS.test(model.id))
		.map((model) => model.id)
		.sort();
}

export interface ChatRequest {
	model: string;
	messages: { role: 'system' | 'user'; content: string }[];
	response_format:
		| { type: 'json_schema'; json_schema: { name: string; strict: true; schema: object } }
		| { type: 'json_object' };
	max_completion_tokens: number;
}

interface ChatResponse {
	choices?: { message?: { content?: string | null }; finish_reason?: string }[];
}

/** What the model answered, or '' when it answered nothing. Throws when the answer was cut short. */
export async function complete(apiKey: string, request: ChatRequest): Promise<string> {
	const response = await call<ChatResponse>(apiKey, '/chat/completions', {
		method: 'POST',
		body: request,
		timeout: 90_000
	});

	const choice = response.choices?.[0];
	// Half a JSON object is no use: better to say so than to keep part of it.
	if (choice?.finish_reason === 'length') {
		throw new Error('La respuesta de Groq quedó incompleta. Pide menos tarjetas.');
	}
	return choice?.message?.content ?? '';
}
