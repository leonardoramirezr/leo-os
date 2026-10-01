// What is done with a song before it goes with a post: drawn, so that its moment can be picked, and
// for a file of one's own, that moment cut out of it. Only the clip is kept, never the whole song.
import { cutMp3, readMp3, readTags, type Mp3 } from './mp3';

/** Seconds of a song a post plays at most before starting over. */
export const CLIP_SECONDS = 30;

/**
 * The rate songs are decoded at. Plenty for a waveform and for a phone's speaker, and a whole song
 * decoded at it is a quarter of what it takes at a CD's.
 */
const RATE = 22050;

/** Decodes audio at RATE. Undefined when the browser cannot read it. */
export async function decode(buffer: ArrayBuffer): Promise<AudioBuffer | undefined> {
	try {
		// An offline context decodes at its own rate and plays nothing.
		const context = new OfflineAudioContext(1, 1, RATE);
		// Decoding takes the buffer away from whoever handed it over: it gets a copy.
		return await context.decodeAudioData(buffer.slice(0));
	} catch {
		return undefined;
	}
}

/** How loud each stretch of the song is, from 0 to 1: the bars its moment is picked on. */
export function peaks(audio: AudioBuffer, bars: number): number[] {
	const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
	const step = Math.max(1, Math.floor(audio.length / bars));
	const levels: number[] = [];
	for (let bar = 0; bar < bars; bar++) {
		let sum = 0;
		let count = 0;
		for (let i = bar * step, end = Math.min(audio.length, i + step); i < end; i += 8) {
			for (const data of channels) sum += data[i] * data[i];
			count += channels.length;
		}
		levels.push(count ? Math.sqrt(sum / count) : 0);
	}
	const loudest = Math.max(...levels, 1e-4);
	return levels.map((level) => level / loudest);
}

/** A song picked from the device. */
export interface Upload {
	title: string;
	artist: string;
	duration: number;
	/** Its frames, for an MP3: the clip is cut from them without touching the sound. */
	mp3?: Mp3;
	/** The decoded sound, when the browser could read it: the waveform, and any other clip. */
	audio?: AudioBuffer;
	/** For listening while the moment is picked. */
	url: string;
}

/** Reads a song from the device. Undefined when it is neither an MP3 nor anything the browser plays. */
export async function readUpload(file: File): Promise<Upload | undefined> {
	const buffer = await file.arrayBuffer();
	const mp3 = readMp3(buffer);
	const audio = await decode(buffer);
	// An MP3 is timed by its frames, which are what its clip is cut by.
	const duration = mp3?.duration ?? audio?.duration ?? 0;
	if (!(duration > 0) || (!mp3 && !audio)) return undefined;

	// Without a tag, the file's name, which is usually «Artist - Title».
	const tags = mp3 ? readTags(buffer) : { title: '', artist: '' };
	const name = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
	const [artist, title] = name.includes(' - ') ? name.split(' - ', 2) : ['', name];
	return {
		title: tags.title || title.trim(),
		artist: tags.artist || artist.trim(),
		duration,
		mp3,
		audio,
		url: URL.createObjectURL(file)
	};
}

/**
 * The sound of a stretch of the song as a WAV file: one channel at RATE, sixteen bits. Only for
 * what is not an MP3, which keeps its own sound; a browser can encode nothing else by itself.
 */
function wav(audio: AudioBuffer, start: number, length: number): Blob {
	const from = Math.floor(start * audio.sampleRate);
	const count = Math.max(0, Math.min(audio.length, Math.ceil((start + length) * audio.sampleRate)) - from);
	const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));

	const view = new DataView(new ArrayBuffer(44 + count * 2));
	const ascii = (at: number, text: string) => {
		for (let i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i));
	};
	ascii(0, 'RIFF');
	view.setUint32(4, 36 + count * 2, true);
	ascii(8, 'WAVE');
	ascii(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // one channel
	view.setUint32(24, audio.sampleRate, true);
	view.setUint32(28, audio.sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	ascii(36, 'data');
	view.setUint32(40, count * 2, true);

	for (let i = 0; i < count; i++) {
		let sample = 0;
		for (const data of channels) sample += data[from + i];
		sample = Math.max(-1, Math.min(1, sample / channels.length));
		view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
	}
	return new Blob([view], { type: 'audio/wav' });
}

/**
 * The clip that goes with the post, and where in it the chosen moment starts: an MP3 cut starts a
 * little before it (see `cutMp3`).
 */
export function cutClip(upload: Upload, start: number, length: number): { clip: Blob; lead: number } {
	if (upload.mp3) return cutMp3(upload.mp3, start, length);
	if (!upload.audio) throw new Error('No se pudo leer la canción.');
	return { clip: wav(upload.audio, start, length), lead: 0 };
}
