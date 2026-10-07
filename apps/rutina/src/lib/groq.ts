// Minimal client for the two parts of the Groq API this app uses, called straight from the browser:
// the list of models, and a chat model that matches the exercises of an imported routine to the
// catalog's. Groq answers requests from any origin, so there is nobody in between.

const API_URL = 'https://api.groq.com/openai/v1';

/** Matches exercises until another model is picked: the one the other apps use. */
export const DEFAULT_MODEL = 'openai/gpt-oss-120b';

/** What `/models` lists besides chat models: speech, voices, safety classifiers, agent systems. */
const NOT_FOR_TEXT = /whisper|transcri|tts|orpheus|playai|guard|compound/i;

export class GroqError extends Error {
	/** `status` is 0 when Groq couldn't be reached. */
	constructor(
		message: string,
		readonly status: number,
		readonly code?: string
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
				response.status,
				data?.error?.code ?? undefined
			);
		}
		// Cut off by the timeout halfway through the body, or not JSON at all.
		if (data === undefined) throw new GroqError('Invalid response', 0);
		return data as T;
	} finally {
		clearTimeout(timer);
	}
}

/** Every model the key can use, in alphabetical order, which groups them by maker. */
export async function listModels(apiKey: string): Promise<string[]> {
	const { data } = await call<{ data?: { id: string; active?: boolean }[] }>(apiKey, '/models', {
		timeout: 20_000
	});

	return (data ?? [])
		.filter((model) => model.active !== false)
		.map((model) => model.id)
		.sort();
}

/** The chat models among `ids`, with `current` among them even if Groq no longer lists it. */
export function chatModels(ids: string[], current: string): string[] {
	const found = ids.filter((id) => !NOT_FOR_TEXT.test(id));
	const models = found.length ? found : [DEFAULT_MODEL];
	return models.includes(current) ? models : [current, ...models];
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
	if (choice?.finish_reason === 'length') throw new Error('La respuesta de Groq quedó incompleta.');
	return choice?.message?.content ?? '';
}

/** What went wrong, in a sentence for the screen. */
export function describe(error: unknown): string {
	if (!(error instanceof GroqError)) {
		return error instanceof Error && error.message ? error.message : 'Algo salió mal.';
	}

	if (error.status === 0) return 'No se pudo conectar con Groq. Revisa tu conexión e inténtalo de nuevo.';
	if (error.status === 401) return 'Groq rechazó la API key.';
	if (error.status === 429) return 'Groq pide esperar: tu API key llegó a su límite de uso por ahora.';
	// Groq retires models: the one picked in the settings may be gone.
	if (error.status === 404 || error.code === 'model_not_found' || error.code === 'model_decommissioned') {
		return 'Groq ya no tiene el modelo elegido. Elige otro en Ajustes.';
	}
	return error.message;
}
