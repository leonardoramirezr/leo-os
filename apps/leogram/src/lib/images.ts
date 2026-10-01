// Photos as a post keeps them: cut to the post's shape where the author framed them, 1080 pixels
// wide as Instagram has them, and as JPEG, which Safari can write and which keeps them small. They
// go to the database as data URLs, because whoever opens the link has to see them too.

/** Instagram's shapes, as width over height. */
export const ASPECTS = { square: 1, portrait: 4 / 5, landscape: 1.91 } as const;
export type Aspect = keyof typeof ASPECTS;

/** Where in a photo the frame sits, from 0 to 1 across and down: 0.5 is centred. */
export interface Focus {
	x: number;
	y: number;
}

type Source = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

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
	return image instanceof HTMLImageElement
		? { width: image.naturalWidth, height: image.naturalHeight }
		: { width: image.width, height: image.height };
}

/** `image` cut to `ratio` around `focus`, `width` pixels wide at most: never more than it has. */
function frame(image: Source, ratio: number, focus: Focus, width: number): HTMLCanvasElement {
	const source = sizeOf(image);
	const cropWidth = Math.min(source.width, source.height * ratio);
	const cropHeight = cropWidth / ratio;

	const canvas = document.createElement('canvas');
	canvas.width = Math.round(Math.min(width, cropWidth));
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

function readAsDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la foto.'));
		reader.readAsDataURL(blob);
	});
}

/** As a JPEG data URL. One that comes out heavy goes again, lighter: every visit downloads it. */
async function jpeg(canvas: HTMLCanvasElement, quality: number): Promise<string> {
	let blob = await blobOf(canvas, quality);
	if (blob.size > 600_000) blob = await blobOf(canvas, quality - 0.15);
	return readAsDataUrl(blob);
}

/** A photo of the carousel, and its canvas, which the grid's thumbnail is cut from. */
export async function slide(image: Source, aspect: Aspect, focus: Focus) {
	const canvas = frame(image, ASPECTS[aspect], focus, 1080);
	return { url: await jpeg(canvas, 0.85), canvas };
}

/** The first photo as the grid shows it: the middle square of its frame, a third of a screen wide. */
export function thumbnail(slideCanvas: HTMLCanvasElement): Promise<string> {
	return jpeg(frame(slideCanvas, 1, CENTRED, 360), 0.7);
}

/** A profile photo: small, since it goes along with every comment of its owner. */
export async function avatar(file: Blob): Promise<string> {
	return jpeg(frame(await load(file), 1, CENTRED, 160), 0.8);
}
