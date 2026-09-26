// Minimal client for the one part of the Groq API that WillChat uses, called straight from the
// browser: Whisper turns what was dictated into text. Groq answers requests from any origin, so
// there is nobody in between.

const API_URL = 'https://api.groq.com/openai/v1';

/** Speech to text: the model Lista transcribes with too. */
export const TRANSCRIPTION_MODEL = 'whisper-large-v3';

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
	/** The audio, as a form. */
	body?: FormData;
	signal?: AbortSignal;
	/** Milliseconds to wait for the whole answer. */
	timeout: number;
}

async function call<T>(apiKey: string, path: string, { method = 'GET', body, signal, timeout }: CallOptions) {
	signal?.throwIfAborted();

	const controller = new AbortController();
	const abort = () => controller.abort(signal?.reason);
	signal?.addEventListener('abort', abort);
	const timer = setTimeout(() => controller.abort(), timeout);

	try {
		let response: Response;
		try {
			response = await fetch(`${API_URL}${path}`, {
				method,
				// No Content-Type: a form sets its own, with the boundary between its parts.
				headers: { Authorization: `Bearer ${apiKey}` },
				body,
				signal: controller.signal
			});
		} catch (error) {
			if (signal?.aborted) throw error;
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
		signal?.removeEventListener('abort', abort);
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
export async function transcribe(
	apiKey: string,
	audio: Blob,
	language: string,
	signal?: AbortSignal
): Promise<string> {
	const form = new FormData();
	// Named with the extension of its format, which is what the endpoint goes by.
	form.append('file', audio, `dictation.${extensionOf(audio.type)}`);
	form.append('model', TRANSCRIPTION_MODEL);
	// Told rather than detected: a short message is too little for Whisper to be sure of the language,
	// and on a wrong guess it writes down what was said in the other one. The app's is the best bet.
	form.append('language', language);
	// Segment by segment, each with how sure Whisper is that it heard speech at all.
	form.append('response_format', 'verbose_json');
	form.append('temperature', '0');

	const result = await call<{ text?: string; segments?: Segment[] }>(apiKey, '/audio/transcriptions', {
		method: 'POST',
		body: form,
		signal,
		timeout: 60_000
	});
	if (!Array.isArray(result.segments)) return (result.text ?? '').trim();

	// Out of silence Whisper makes words up («Gracias.», «Thanks for watching!»). This is its own rule
	// for telling: a segment it doubts is speech, and whose words it is unsure of, is dropped.
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
