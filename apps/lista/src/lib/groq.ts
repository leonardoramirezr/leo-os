// Minimal client for the two parts of the Groq API this app uses, called straight from the browser:
// Whisper turns what was said into text, and a chat model decides what that text does to the list.
// Groq answers requests from any origin, so there is nobody in between.

const API_URL = 'https://api.groq.com/openai/v1';

/** Speech to text. */
export const TRANSCRIPTION_MODEL = 'whisper-large-v3';

/** Reads what was said and decides what it does to the list. */
export const LIST_MODEL = 'openai/gpt-oss-120b';

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

/** Only asked for to tell whether a key is good. */
export function listModels(apiKey: string) {
	return call<{ data: { id: string }[] }>(apiKey, '/models', { timeout: 20_000 });
}

interface Segment {
	text: string;
	avg_logprob: number;
	no_speech_prob: number;
}

/** What was said, as text. Empty when all Whisper heard was silence or noise. */
export async function transcribe(apiKey: string, audio: Blob): Promise<string> {
	const form = new FormData();
	// Named with the extension of its format, which is what the endpoint goes by.
	form.append('file', audio, `voz.${extensionOf(audio.type)}`);
	form.append('model', TRANSCRIPTION_MODEL);
	// Told rather than detected: a handful of words is too little for Whisper to be sure of the
	// language, and a list here is dictated in Spanish.
	form.append('language', 'es');
	// Segment by segment, each with how sure Whisper is that it heard speech at all.
	form.append('response_format', 'verbose_json');
	form.append('temperature', '0');

	const result = await call<{ text?: string; segments?: Segment[] }>(apiKey, '/audio/transcriptions', {
		method: 'POST',
		body: form,
		timeout: 60_000
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
	response_format: {
		type: 'json_schema';
		json_schema: { name: string; strict: true; schema: object };
	};
	reasoning_effort: 'low' | 'medium' | 'high';
	include_reasoning: false;
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
		timeout: 60_000
	});

	const choice = response.choices?.[0];
	// Half a JSON object is no use: better to say so than to act on part of it.
	if (choice?.finish_reason === 'length') throw new Error('La respuesta de Groq quedó incompleta.');
	return choice?.message?.content ?? '';
}
