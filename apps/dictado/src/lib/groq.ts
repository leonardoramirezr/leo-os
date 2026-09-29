// Minimal client for the parts of the Groq API this app uses, called straight from the browser: the
// list of models, Whisper turning what was said into text, and a chat model rewriting that text.
// Groq answers requests from any origin, so there is nobody in between.

const API_URL = 'https://api.groq.com/openai/v1';

/** Speech to text until another model is picked: the one Lista and WillChat transcribe with. */
export const DEFAULT_TRANSCRIPTION_MODEL = 'whisper-large-v3';

/** Improves and edits the text until another model is picked. */
export const DEFAULT_CHAT_MODEL = 'openai/gpt-oss-120b';

/** Offered until the key's own list comes in, or if it lists none. */
const KNOWN_TRANSCRIPTION_MODELS = ['whisper-large-v3', 'whisper-large-v3-turbo'];

/** The speech to text models `/models` lists, among everything else. */
const TRANSCRIPTION = /whisper|transcri/i;

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

/** The speech to text models among `ids`, with `current` among them even if Groq no longer lists it. */
export function transcriptionModels(ids: string[], current: string): string[] {
	const found = ids.filter((id) => TRANSCRIPTION.test(id));
	return withCurrent(found.length ? found : KNOWN_TRANSCRIPTION_MODELS, current);
}

/** The chat models among `ids`, with `current` among them even if Groq no longer lists it. */
export function chatModels(ids: string[], current: string): string[] {
	const found = ids.filter((id) => !NOT_FOR_TEXT.test(id));
	return withCurrent(found.length ? found : [DEFAULT_CHAT_MODEL], current);
}

function withCurrent(models: string[], current: string): string[] {
	return models.includes(current) ? models : [current, ...models];
}

interface Segment {
	text: string;
	avg_logprob: number;
	no_speech_prob: number;
}

export interface Transcription {
	model: string;
	/** What the dictation is in, as ISO-639-1 (`es`). Empty lets Whisper work it out. */
	language: string;
}

/** What was said, as text. Empty when all Whisper heard was silence or noise. */
export async function transcribe(
	apiKey: string,
	audio: Blob,
	{ model, language }: Transcription
): Promise<string> {
	const form = new FormData();
	// Named with the extension of its format, which is what the endpoint goes by.
	form.append('file', audio, `dictado.${extensionOf(audio.type)}`);
	form.append('model', model);
	// Told rather than detected unless the settings say otherwise: a few words are too little for
	// Whisper to be sure of the language, and on a wrong guess it writes down what was said in the
	// other one.
	if (language) form.append('language', language);
	// Segment by segment, each with how sure Whisper is that it heard speech at all.
	form.append('response_format', 'verbose_json');
	form.append('temperature', '0');

	const result = await call<{ text?: string; segments?: Segment[] }>(apiKey, '/audio/transcriptions', {
		method: 'POST',
		body: form,
		// Ten minutes of audio is several megabytes to send over a phone's connection.
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
	// Half a text would take the place of all of it: better to say so and leave it as it was.
	if (choice?.finish_reason === 'length') throw new Error('La respuesta de Groq quedó incompleta.');
	return choice?.message?.content ?? '';
}
