// Minimal client for the parts of the Groq API this app uses, called straight from the browser: the
// list of models; Whisper, which writes down a routine dictated; and a chat model, which turns a
// routine described in words into one, and matches the exercises of an imported routine to the
// catalog's. Groq answers requests from any origin, so there is nobody in between.

const API_URL = 'https://api.groq.com/openai/v1';

/** Writes routines and matches exercises until another model is picked: the one the other apps use. */
export const DEFAULT_MODEL = 'openai/gpt-oss-120b';

/** Speech to text: the model Lista and WillChat transcribe with. */
export const TRANSCRIPTION_MODEL = 'whisper-large-v3';

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
	/** Sent as JSON, except a form, which carries the audio. */
	body?: unknown;
	/** Milliseconds to wait for the whole answer. */
	timeout: number;
}

async function call<T>(apiKey: string, path: string, { method = 'GET', body, timeout }: CallOptions) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	const form = body instanceof FormData;

	try {
		let response: Response;
		try {
			response = await fetch(`${API_URL}${path}`, {
				method,
				headers: {
					Authorization: `Bearer ${apiKey}`,
					// A form sets its own, with the boundary between its parts.
					...(body === undefined || form ? {} : { 'Content-Type': 'application/json' })
				},
				body: body === undefined ? undefined : form ? body : JSON.stringify(body),
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

/**
 * Words Whisper is told to expect, with the numbers written as digits. At the gym, Spanish is full of
 * English names — press, curl, hip thrust — that it would otherwise spell as Spanish words.
 */
const VOCABULARY =
	'Lunes: press de banca 4 series de 8 con 60 kg, sentadilla, peso muerto rumano, hip thrust, ' +
	'dominadas, remo, curl, plancha de 45 segundos, 90 segundos de descanso.';

interface Segment {
	text: string;
	avg_logprob: number;
	no_speech_prob: number;
}

/** What was said, as text. Empty when all Whisper heard was silence or noise. */
export async function transcribe(apiKey: string, audio: Blob): Promise<string> {
	const form = new FormData();
	// Named with the extension of its format, which is what the endpoint goes by.
	form.append('file', audio, `rutina.${extensionOf(audio.type)}`);
	form.append('model', TRANSCRIPTION_MODEL);
	// Told rather than detected: the names of exercises in English would have Whisper unsure of the
	// language, and on a wrong guess it writes down what was said in the other one.
	form.append('language', 'es');
	form.append('prompt', VOCABULARY);
	// Segment by segment, each with how sure Whisper is that it heard speech at all.
	form.append('response_format', 'verbose_json');
	form.append('temperature', '0');

	const result = await call<{ text?: string; segments?: Segment[] }>(apiKey, '/audio/transcriptions', {
		method: 'POST',
		body: form,
		// Minutes of audio are megabytes to send over a phone's connection, from a gym as often as not.
		timeout: 120_000
	});
	if (!Array.isArray(result.segments)) return (result.text ?? '').trim();

	// Out of silence Whisper makes words up («Gracias.», «Subtítulos realizados por…»). This is its own
	// rule for telling: a segment it doubts is speech, and whose words it is unsure of, is dropped.
	return result.segments
		.filter((segment) => !(segment.no_speech_prob > 0.6 && segment.avg_logprob < -1))
		.map((segment) => segment.text)
		.join('')
		.trim();
}

/** The extension Groq expects for what MediaRecorder made: webm in Chrome, mp4 in Safari. */
function extensionOf(type: string) {
	if (/mp4|m4a|aac/.test(type)) return 'm4a';
	if (/ogg/.test(type)) return 'ogg';
	if (/wav/.test(type)) return 'wav';
	if (/mpeg|mp3/.test(type)) return 'mp3';
	return 'webm';
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

/**
 * Takes the JSON out of whatever came with it: a chat model's answer may wrap it in a code block,
 * or a sentence before and after.
 */
export function jsonIn(text: string): string {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

export interface JSONRequest {
	model: string;
	messages: ChatRequest['messages'];
	/** The answer's shape, by name and as a JSON Schema that strict mode can hold a model to. */
	name: string;
	schema: object;
	max_completion_tokens: number;
}

/** Models that turned strict mode down during this visit: they get a plain JSON object straight away. */
const withoutSchema = new Set<string>();

/**
 * A JSON object from a chat model, parsed. The models that can are held to the schema; the rest are
 * only asked for a JSON object, so the messages have to describe its shape too.
 */
export async function completeJSON(
	apiKey: string,
	{ model, messages, name, schema, max_completion_tokens }: JSONRequest
): Promise<unknown> {
	let content: string | undefined;
	if (!withoutSchema.has(model)) {
		try {
			content = await complete(apiKey, {
				model,
				messages,
				response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
				max_completion_tokens
			});
		} catch (error) {
			// «This model does not support response format `json_schema`»: which models do changes as
			// Groq adds and retires them.
			const refused =
				error instanceof GroqError && error.status === 400 && /json_schema|response.format/i.test(error.message);
			if (!refused) throw error;
			withoutSchema.add(model);
		}
	}

	content ??= await complete(apiKey, {
		model,
		messages,
		response_format: { type: 'json_object' },
		max_completion_tokens
	});

	// Outside strict mode a model may think out loud first, or wrap the object in a sentence.
	try {
		return JSON.parse(jsonIn(content.replace(/<think>[\s\S]*?<\/think>/g, '')));
	} catch {
		throw new Error('No se entendió la respuesta de Groq.');
	}
}

/** What went wrong, in a sentence for the screen. */
export function describe(error: unknown): string {
	if (!(error instanceof GroqError)) {
		return error instanceof Error && error.message ? error.message : 'Algo salió mal.';
	}

	if (error.status === 0) return 'No se pudo conectar con Groq. Revisa tu conexión e inténtalo de nuevo.';
	if (error.status === 401) return 'Groq rechazó la API key.';
	if (error.status === 429) return 'Groq pide esperar: tu API key llegó a su límite de uso por ahora.';
	if (error.status === 413) return 'La grabación es demasiado larga.';
	// Groq retires models: the one picked in the settings may be gone.
	if (error.status === 404 || error.code === 'model_not_found' || error.code === 'model_decommissioned') {
		return 'Groq ya no tiene el modelo elegido. Elige otro en Ajustes.';
	}
	return error.message;
}
