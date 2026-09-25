// The microphone, recorded with MediaRecorder in whichever format the browser makes — webm with Opus
// in Chrome and Firefox, mp4 in Safari — since Groq takes both. It is only open while recording:
// kept open, it would leave the microphone indicator on and the battery draining.

export class MicrophoneError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MicrophoneError';
	}
}

export interface Recording {
	/** How loud the microphone is right now, from 0 to 1. */
	level(): number;
	/** Closes the microphone and hands over what it heard. */
	stop(): Promise<Blob>;
	/** Closes the microphone and throws away what it heard. */
	cancel(): void;
}

/** In order of preference: the first one the browser can make is the one used. */
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'];

export async function record(): Promise<Recording> {
	if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
		throw new MicrophoneError('Este navegador no puede grabar audio.');
	}

	// Created before waiting for the microphone: Safari only lets audio start inside the tap itself.
	const context = audioContext();

	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	} catch (error) {
		context?.close().catch(() => {});
		const name = error instanceof DOMException ? error.name : '';
		throw new MicrophoneError(
			name === 'NotAllowedError' || name === 'SecurityError'
				? 'No hay permiso para usar el micrófono. Actívalo en los ajustes del navegador.'
				: 'No se pudo abrir el micrófono.'
		);
	}

	const awake = keepAwake();
	const release = () => {
		for (const track of stream.getTracks()) track.stop();
		context?.close().catch(() => {});
		awake.then((lock) => lock?.release()).catch(() => {});
	};

	const type = TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate));
	const chunks: Blob[] = [];
	let recorder: MediaRecorder;
	let stopped: Promise<void>;
	try {
		recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
		recorder.ondataavailable = (event) => {
			if (event.data.size > 0) chunks.push(event.data);
		};
		// An error stops the recorder too, and whatever it had gathered is still worth sending.
		stopped = new Promise<void>((resolve) => {
			recorder.onstop = () => resolve();
			recorder.onerror = () => resolve();
		});
		recorder.start();
	} catch {
		release();
		throw new MicrophoneError('Este navegador no puede grabar audio.');
	}

	const analyser = context ? tap(context, stream) : undefined;
	const samples = new Uint8Array(analyser?.fftSize ?? 0);

	return {
		level() {
			if (!analyser) return 0;
			analyser.getByteTimeDomainData(samples);
			let sum = 0;
			for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
			// Speech rarely goes past a quarter of full scale: stretched so it fills the meter.
			return Math.min(1, Math.sqrt(sum / samples.length) * 4);
		},
		async stop() {
			if (recorder.state !== 'inactive') recorder.stop();
			await stopped;
			release();
			return new Blob(chunks, { type: recorder.mimeType || type || 'audio/webm' });
		},
		cancel() {
			if (recorder.state !== 'inactive') recorder.stop();
			release();
		}
	};
}

function audioContext(): AudioContext | undefined {
	if (typeof AudioContext === 'undefined') return undefined;

	try {
		const context = new AudioContext();
		context.resume().catch(() => {});
		return context;
	} catch {
		// Without it there is no level meter, and nothing else is missing.
		return undefined;
	}
}

/** Listens in on the microphone for the level meter. */
function tap(context: AudioContext, stream: MediaStream): AnalyserNode | undefined {
	try {
		const analyser = context.createAnalyser();
		analyser.fftSize = 1024;
		const silence = context.createGain();
		silence.gain.value = 0;
		// Through to the speakers at no volume: a graph that leads nowhere may not be run at all.
		const source = context.createMediaStreamSource(stream);
		source.connect(analyser).connect(silence).connect(context.destination);
		return analyser;
	} catch {
		return undefined;
	}
}

/**
 * Keeps the screen on while recording. A long list dictated without touching the phone would
 * otherwise let it lock, and a locked phone stops the microphone halfway through.
 */
async function keepAwake(): Promise<WakeLockSentinel | undefined> {
	try {
		return await navigator.wakeLock?.request('screen');
	} catch {
		return undefined;
	}
}
