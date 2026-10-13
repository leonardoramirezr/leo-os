// An MP3 is a run of frames, each a few hundredths of a second long and readable on its own, so a
// moment of a song can be cut out of the file byte for byte: no decoding, no encoding, and the clip
// sounds exactly as the song did. Only MPEG audio Layer III is read, which is what «.mp3» means.

/** One frame: where it starts in the file and how many bytes it takes. */
interface Frame {
	offset: number;
	length: number;
}

export interface Mp3 {
	bytes: Uint8Array;
	/** The frames that carry sound, in order. */
	frames: Frame[];
	/** Seconds per frame: the same all through a file. */
	frameSeconds: number;
	/** Seconds of sound in the whole file. */
	duration: number;
}

// Kilobits per second by the header's index, for MPEG-1 and for MPEG-2 and 2.5, Layer III.
const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
// Samples per second by the header's index: MPEG-1, MPEG-2, MPEG-2.5.
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] } as const;

interface Header {
	length: number;
	samples: number;
	rate: number;
	/** MPEG-1, which sizes its side information differently. */
	v1: boolean;
	mono: boolean;
}

function header(bytes: Uint8Array, at: number): Header | undefined {
	if (at + 4 > bytes.length) return undefined;
	const [b0, b1, b2, b3] = [bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]];
	if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) return undefined;

	const version = (b1 >> 3) & 3; // 3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5, 1: reserved
	const layer = (b1 >> 1) & 3; // 1: Layer III
	const bitrateIndex = b2 >> 4;
	const rateIndex = (b2 >> 2) & 3;
	if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) {
		return undefined;
	}

	const v1 = version === 3;
	const kbps = (v1 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex];
	const rate = RATES[version as 3 | 2 | 0][rateIndex];
	const padding = (b2 >> 1) & 1;
	const length = Math.floor(((v1 ? 144000 : 72000) * kbps) / rate) + padding;
	return { length, samples: v1 ? 1152 : 576, rate, v1, mono: b3 >> 6 === 3 };
}

/** A size as ID3 writes most of them: seven bits to a byte, so that none looks like a frame. */
function syncsafe(bytes: Uint8Array, at: number): number {
	return (bytes[at] << 21) | (bytes[at + 1] << 14) | (bytes[at + 2] << 7) | bytes[at + 3];
}

function uint32(bytes: Uint8Array, at: number): number {
	return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

/** Where the sound starts: after the ID3v2 tag, if the file opens with one. */
function afterTag(bytes: Uint8Array): number {
	if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0; // "ID3"
	const footer = bytes[5] & 0x10 ? 10 : 0;
	return 10 + syncsafe(bytes, 6) + footer;
}

/**
 * The first frame worth believing: one whose next frame starts right where it says. A stray 0xFF
 * in a tag or in the cover art looks like a frame for four bytes, and rarely for two frames running.
 */
function firstFrame(bytes: Uint8Array, from: number): number {
	for (let at = from; at + 4 < bytes.length; at++) {
		const first = header(bytes, at);
		if (!first) continue;
		const next = header(bytes, at + first.length);
		if (next && next.rate === first.rate) return at;
	}
	return -1;
}

/**
 * The frame some encoders put first, which holds no sound but the length of the whole file
 * (Xing, Info or VBRI). Cut out of its file it would lie about the clip's length: it is left out.
 */
function isInfoFrame(bytes: Uint8Array, at: number, frame: Header): boolean {
	const side = frame.v1 ? (frame.mono ? 17 : 32) : frame.mono ? 9 : 17;
	const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
	const xing = tag(at + 4 + side);
	return xing === 'Xing' || xing === 'Info' || tag(at + 36) === 'VBRI';
}

/** Reads the frames of an MP3. Undefined when the file is not one. */
export function readMp3(buffer: ArrayBuffer): Mp3 | undefined {
	const bytes = new Uint8Array(buffer);
	let at = firstFrame(bytes, afterTag(bytes));
	if (at < 0) return undefined;

	const frames: Frame[] = [];
	let frameSeconds = 0;
	while (at + 4 <= bytes.length) {
		const frame = header(bytes, at);
		if (!frame) {
			// Junk between frames, or the ID3v1 tag at the very end: look for where frames go on.
			const next = firstFrame(bytes, at + 1);
			if (next < 0) break;
			at = next;
			continue;
		}
		if (at + frame.length > bytes.length) break;
		if (frames.length > 0 || !isInfoFrame(bytes, at, frame)) {
			frames.push({ offset: at, length: frame.length });
			frameSeconds = frame.samples / frame.rate;
		}
		at += frame.length;
	}

	if (frames.length < 2) return undefined;
	return { bytes, frames, frameSeconds, duration: frames.length * frameSeconds };
}

/**
 * The frames from `start` for `length` seconds, as a file of their own. It begins a couple of
 * frames early: a frame may lean on the bytes of the one before (MP3's bit reservoir), and the
 * first frames of a clip can come out garbled. `lead` says how far into the clip the moment asked
 * for starts, which is where it plays from, and where it goes back to.
 */
export function cutMp3(mp3: Mp3, start: number, length: number): { clip: Blob; lead: number } {
	const { frames, frameSeconds } = mp3;
	const from = Math.max(0, Math.floor(start / frameSeconds) - 2);
	const to = Math.min(frames.length, Math.ceil((start + length) / frameSeconds) + 1);

	const chosen = frames.slice(from, to);
	const out = new Uint8Array(chosen.reduce((sum, frame) => sum + frame.length, 0));
	let at = 0;
	for (const frame of chosen) {
		out.set(mp3.bytes.subarray(frame.offset, frame.offset + frame.length), at);
		at += frame.length;
	}
	return { clip: new Blob([out], { type: 'audio/mpeg' }), lead: start - from * frameSeconds };
}

/** Text from the ID3v2 tag, in whichever of its four encodings it was written. */
function text(frame: Uint8Array): string {
	const [encoding] = frame;
	let body = frame.subarray(1);
	let label = encoding === 0 ? 'latin1' : encoding === 2 ? 'utf-16be' : encoding === 3 ? 'utf-8' : '';
	if (encoding === 1) {
		// UTF-16 says its byte order in its first two bytes.
		label = body[0] === 0xfe && body[1] === 0xff ? 'utf-16be' : 'utf-16le';
		body = body.subarray(2);
	}
	try {
		// A list of values is separated by nulls: the first one does.
		return new TextDecoder(label).decode(body).split('\0')[0].trim();
	} catch {
		return '';
	}
}

/**
 * The song's title and artist, as the file's ID3v2 tag says, so they need not be typed. Empty
 * where the tag says nothing, or there is no tag.
 */
export function readTags(buffer: ArrayBuffer): { title: string; artist: string } {
	const bytes = new Uint8Array(buffer);
	const found = { title: '', artist: '' };
	const end = Math.min(bytes.length, afterTag(bytes));
	if (end === 0) return found;

	const major = bytes[3];
	// Version 2.2 names frames in three letters and sizes them in three bytes, without flags.
	const short = major === 2;
	const headerLength = short ? 6 : 10;
	const ids = short ? { title: 'TT2', artist: 'TP1' } : { title: 'TIT2', artist: 'TPE1' };

	// An extended header, when the flags say there is one, comes before the frames.
	let at = 10;
	if (!short && bytes[5] & 0x40) at += major === 4 ? syncsafe(bytes, 10) : uint32(bytes, 10) + 4;

	while (at + headerLength < end) {
		const id = String.fromCharCode(...bytes.subarray(at, at + (short ? 3 : 4)));
		// What follows the last frame is padding.
		if (!/^[A-Z0-9]+$/.test(id)) break;
		const size = short
			? (bytes[at + 3] << 16) | (bytes[at + 4] << 8) | bytes[at + 5]
			: major === 4
				? syncsafe(bytes, at + 4)
				: uint32(bytes, at + 4);
		const body = bytes.subarray(at + headerLength, at + headerLength + size);
		if (id === ids.title) found.title = text(body);
		if (id === ids.artist) found.artist = text(body);
		at += headerLength + size;
	}
	return found;
}
