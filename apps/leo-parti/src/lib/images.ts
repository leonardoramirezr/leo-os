// Photos as a post keeps them: cut to the post's shape where the author framed them, with what was
// written on them, 1080 pixels wide as Instagram has them, and as JPEG, which Safari can write and
// which keeps them small. A video goes as it was recorded, since a browser cannot cut one, and is
// framed when it is shown; what is cut for it here is its poster, the frame that shows until it plays.
import { drawTexts, type TextLayer } from './text';

/** Instagram's shapes, as width over height. */
export const ASPECTS = { square: 1, portrait: 4 / 5, landscape: 1.91 } as const;
export type Aspect = keyof typeof ASPECTS;

/** Where in a photo the frame sits, from 0 to 1 across and down: 0.5 is centred. */
export interface Focus {
	x: number;
	y: number;
}

type Source = ImageBitmap | HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

const CENTRED: Focus = { x: 0.5, y: 0.5 };

/** The shape that crops the least of this photo. */
export function closestAspect(width: number, height: number): Aspect {
	const ratio = width / height;
	const off = (aspect: Aspect) => Math.abs(Math.log(ASPECTS[aspect] / ratio));
	const aspects = Object.keys(ASPECTS) as Aspect[];
	return aspects.reduce((best, aspect) => (off(aspect) < off(best) ? aspect : best));
}

/** A photo ready to draw, turned the way the camera held it. */
export async function load(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
	try {
		return await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		// Older Safari: an <img> reads the orientation too.
		const image = new Image();
		const url = URL.createObjectURL(file);
		try {
			image.src = url;
			await image.decode();
			return image;
		} finally {
			URL.revokeObjectURL(url);
		}
	}
}

export function sizeOf(image: Source): { width: number; height: number } {
	if (image instanceof HTMLImageElement) return { width: image.naturalWidth, height: image.naturalHeight };
	if (image instanceof HTMLVideoElement) return { width: image.videoWidth, height: image.videoHeight };
	return { width: image.width, height: image.height };
}

/**
 * `image` cut to `ratio` around `focus`, `width` pixels wide at most: never more than it has, unless
 * `full` asks for all of `width` anyway.
 */
function frame(image: Source, ratio: number, focus: Focus, width: number, full = false): HTMLCanvasElement {
	const source = sizeOf(image);
	const cropWidth = Math.min(source.width, source.height * ratio);
	const cropHeight = cropWidth / ratio;

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(full ? width : Math.min(width, cropWidth));
	canvas.height = Math.round(canvas.width / ratio);
	const context = canvas.getContext('2d');
	if (!context) throw new Error('No se pudo preparar la foto.');
	context.imageSmoothingQuality = 'high';
	context.drawImage(
		image,
		(source.width - cropWidth) * focus.x,
		(source.height - cropHeight) * focus.y,
		cropWidth,
		cropHeight,
		0,
		0,
		canvas.width,
		canvas.height
	);
	return canvas;
}

function blobOf(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('No se pudo preparar la foto.'))),
			'image/jpeg',
			quality
		)
	);
}

/** As a JPEG. One that comes out heavy goes again, lighter: every visit downloads it. */
async function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
	const blob = await blobOf(canvas, quality);
	return blob.size > 600_000 ? blobOf(canvas, quality - 0.15) : blob;
}

/**
 * A photo of the carousel, or a video's poster, and its canvas, which the grid's thumbnail is cut
 * from. A photo with text goes the full 1080 pixels even when it is smaller, so that the letters
 * are as sharp as on any other.
 */
export async function slide(image: Source, aspect: Aspect, focus: Focus, texts: readonly TextLayer[] = []) {
	const canvas = frame(image, ASPECTS[aspect], focus, 1080, texts.length > 0);
	if (texts.length > 0) {
		const context = canvas.getContext('2d');
		if (!context) throw new Error('No se pudo preparar la foto.');
		await document.fonts.ready;
		drawTexts(context, texts, canvas.width, canvas.height);
	}
	return { blob: await jpeg(canvas, 0.85), canvas };
}

/** The first slide as the grid shows it: the middle square of its frame, a third of a screen wide. */
export function thumbnail(slideCanvas: HTMLCanvasElement): Promise<Blob> {
	return jpeg(frame(slideCanvas, 1, CENTRED, 360), 0.7);
}

/** A profile photo: small, since it goes along with every comment of its owner. */
export async function avatar(file: Blob): Promise<Blob> {
	return jpeg(frame(await load(file), 1, CENTRED, 160), 0.8);
}

/** The most a video may weigh; the database holds uploads to the same. */
export const MAX_VIDEO = 300 * 1024 * 1024;

const VIDEO_TYPES: Record<string, string> = {
	mp4: 'video/mp4',
	m4v: 'video/mp4',
	mov: 'video/quicktime',
	webm: 'video/webm'
};

/** The type a video goes up as, by its own or else by its name: MP4, QuickTime or WebM; '' for none. */
export function videoType(file: File): string {
	if (Object.values(VIDEO_TYPES).includes(file.type)) return file.type;
	if (file.type === 'video/x-m4v') return 'video/mp4';
	return VIDEO_TYPES[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? '';
}

/** Waits for `type` on a video, and fails on its `error`, or when nothing comes for a while. */
function event(video: HTMLVideoElement, type: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const done = (error?: Error) => {
			clearTimeout(timer);
			video.removeEventListener(type, ok);
			video.removeEventListener('error', failed);
			if (error) reject(error);
			else resolve();
		};
		const ok = () => done();
		const failed = () => done(new Error('No se pudo leer el video.'));
		const timer = setTimeout(failed, 20_000);
		video.addEventListener(type, ok);
		video.addEventListener('error', failed);
	});
}

/** The longest side of the frame kept of a video: plenty for a poster 1080 wide. */
const FRAME = 1920;

/**
 * A video picked from the device: how big it shows, how long it lasts, and its first frame as a
 * JPEG, which its poster and its thumbnail are cut from. Fails when the browser cannot play it,
 * which is a good sign many of those who open the post could not either.
 */
export async function readVideo(file: Blob) {
	const url = URL.createObjectURL(file);
	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.preload = 'auto';
	try {
		const metadata = event(video, 'loadedmetadata');
		video.src = url;
		await metadata;
		const { width, height } = sizeOf(video);
		if (!width || !height) throw new Error('No se pudo leer el video.');

		// iOS loads none of a video's pictures before it is played: played without sound, and paused.
		await video.play().then(
			() => video.pause(),
			() => {}
		);
		const seeked = event(video, 'seeked');
		// Not the very first frame, which is often black.
		const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
		video.currentTime = duration ? Math.min(0.1, duration / 2) : 0.1;
		await seeked;

		const scale = Math.min(1, FRAME / Math.max(width, height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);
		const context = canvas.getContext('2d');
		if (!context) throw new Error('No se pudo leer el video.');
		context.drawImage(video, 0, 0, canvas.width, canvas.height);
		return { width, height, duration, frame: await blobOf(canvas, 0.9) };
	} finally {
		video.removeAttribute('src');
		video.load();
		URL.revokeObjectURL(url);
	}
}
