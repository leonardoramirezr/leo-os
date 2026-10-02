// Text on a photo, as an Instagram story or a TikTok takes it: one of their typefaces, a colour,
// a background, an outline or a shadow, and wherever, however big and however turned its author
// leaves it. It is drawn into the photo when the post is published, so whoever opens the post sees
// it exactly as it was written, with no font of their own involved. The editor draws it with this
// same code, laid out once at the published photo's width and only scaled, so that what it shows
// is what goes up, line breaks included.
//
// The typefaces are the device's own, and nothing is downloaded for them: iOS has one for each of
// Instagram's and TikTok's, and the other systems fall back to the closest they have.

export type FontId =
	| 'classic'
	| 'modern'
	| 'neon'
	| 'typewriter'
	| 'strong'
	| 'literature'
	| 'hand'
	| 'bubble'
	| 'poster'
	| 'headline';

/**
 * How the colour is used, as the «A» button of a story or a TikTok cycles through them: the letters
 * themselves, a background behind them (solid or see-through), an outline around them, or a hard
 * shadow under them. Anything but `plain` writes the letters in white or black, whichever reads on
 * the colour.
 */
export type Mode = 'plain' | 'box' | 'soft' | 'outline' | 'shadow';

export type Align = 'left' | 'center' | 'right';

export interface TextLayer {
	id: string;
	text: string;
	font: FontId;
	/** `#rrggbb`. */
	color: string;
	mode: Mode;
	align: Align;
	/** Where its middle is, from 0 to 1 across and down the frame. */
	x: number;
	y: number;
	/** The letters' size, out of the frame's width: what the slider sets, and what the lines wrap by. */
	size: number;
	/** What pinching made of it on top of `size`, which keeps its line breaks. */
	scale: number;
	/** Turned clockwise, in radians. */
	angle: number;
}

interface Font {
	/** What its button says, written in the font itself. */
	name: string;
	family: string;
	weight: number;
	italic?: boolean;
	/** In capitals, whatever was typed. */
	caps?: boolean;
	/** Letter spacing, in em. */
	tracking?: number;
	/** Line height, in em. */
	leading: number;
	/** How much bigger than `size` it is drawn, so that every font looks about as big at one size. */
	zoom?: number;
	/** Lit in its colour, as Instagram's Neon: it takes no background. */
	glow?: boolean;
}

/** In the order Instagram lists its own, then the ones TikTok and Instagram added since. */
export const FONTS: Record<FontId, Font> = {
	classic: {
		name: 'Clásica',
		family: "system-ui, -apple-system, 'Helvetica Neue', 'Segoe UI', Roboto, Arial, sans-serif",
		weight: 700,
		leading: 1.2
	},
	modern: {
		name: 'Moderna',
		family: "'Avenir Next', Avenir, Futura, 'Century Gothic', Montserrat, 'Segoe UI', Roboto, sans-serif",
		weight: 600,
		caps: true,
		tracking: 0.1,
		leading: 1.25,
		zoom: 0.9
	},
	neon: {
		name: 'Neón',
		family: "'Snell Roundhand', 'Brush Script MT', 'Segoe Script', 'Dancing Script', cursive",
		weight: 700,
		leading: 1.3,
		zoom: 1.35,
		glow: true
	},
	typewriter: {
		name: 'Máquina de escribir',
		family: "'American Typewriter', 'Courier New', Courier, 'Cutive Mono', monospace",
		weight: 600,
		leading: 1.25
	},
	strong: {
		name: 'Fuerte',
		family:
			"'Avenir Next Condensed', 'Bahnschrift Condensed', Impact, 'Arial Narrow', sans-serif-condensed, sans-serif",
		weight: 800,
		italic: true,
		caps: true,
		leading: 1.1,
		zoom: 1.1
	},
	literature: {
		name: 'Literatura',
		family: "'Iowan Old Style', Georgia, 'Times New Roman', serif",
		weight: 500,
		leading: 1.25,
		zoom: 1.05
	},
	hand: {
		name: 'A mano',
		family: "'Bradley Hand', Noteworthy, 'Segoe Print', 'Ink Free', casual, cursive",
		weight: 700,
		leading: 1.25,
		zoom: 1.1
	},
	bubble: {
		name: 'Burbuja',
		family: "ui-rounded, 'SF Pro Rounded', 'Arial Rounded MT Bold', 'Varela Round', Nunito, sans-serif",
		weight: 800,
		leading: 1.15
	},
	poster: {
		name: 'Póster',
		family: "Didot, 'Bodoni 72', 'Bodoni MT', 'Playfair Display', Georgia, serif",
		weight: 700,
		leading: 1.1,
		zoom: 1.05
	},
	headline: {
		name: 'Titular',
		family:
			"'DIN Condensed', 'Bahnschrift Condensed', 'Arial Narrow', sans-serif-condensed, Impact, sans-serif",
		weight: 700,
		caps: true,
		tracking: 0.02,
		leading: 1,
		zoom: 1.3
	}
};

export const FONT_IDS = Object.keys(FONTS) as FontId[];

/** Instagram's colours for a story's text, in its order. */
export const COLORS = [
	{ hex: '#ffffff', name: 'Blanco' },
	{ hex: '#000000', name: 'Negro' },
	{ hex: '#3897f0', name: 'Azul' },
	{ hex: '#70c050', name: 'Verde' },
	{ hex: '#fdcb5c', name: 'Amarillo' },
	{ hex: '#fd8d32', name: 'Naranja' },
	{ hex: '#ed4956', name: 'Rojo' },
	{ hex: '#d10869', name: 'Fucsia' },
	{ hex: '#a307ba', name: 'Morado' },
	{ hex: '#ed858e', name: 'Rosa' },
	{ hex: '#ffd2d3', name: 'Rosa pálido' },
	{ hex: '#ffdbb4', name: 'Durazno' },
	{ hex: '#d28f47', name: 'Ocre' },
	{ hex: '#996439', name: 'Café' },
	{ hex: '#1c4a28', name: 'Verde oscuro' },
	{ hex: '#262626', name: 'Gris oscuro' },
	{ hex: '#737373', name: 'Gris' },
	{ hex: '#c7c7c7', name: 'Gris claro' }
];

/** What the «A» button says it does, in the order it goes through them. */
export const MODES: Record<Mode, string> = {
	plain: 'Sin fondo',
	box: 'Con fondo',
	soft: 'Con fondo translúcido',
	outline: 'Con contorno',
	shadow: 'Con sombra'
};

export function nextMode(mode: Mode): Mode {
	const modes = Object.keys(MODES) as Mode[];
	return modes[(modes.indexOf(mode) + 1) % modes.length];
}

/** The slider's ends, and where a first text starts, out of the frame's width. */
export const SIZES = { min: 0.03, max: 0.2, initial: 0.075 };

/** The width text is laid out for: a published photo's. Any other is this one, scaled. */
const REFERENCE = 1080;
/** How wide a line gets before it wraps, out of the frame's width. */
const WRAP = 0.9;
/** The room a background leaves around each line, and the rounding of its corners, in em. */
const PAD_X = 0.3;
const PAD_Y = 0.12;
const RADIUS = 0.25;
/** An outline's width, in em: half of it is under the letters. */
const STROKE = 0.16;

// ——— Colour

function channels(hex: string): number[] {
	const value = parseInt(hex.slice(1), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex: string): number {
	const [r, g, b] = channels(hex).map((channel) => {
		const c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `hex` taken `amount` of the way towards `other`. */
function mix(hex: string, other: string, amount: number): string {
	const [a, b] = [channels(hex), channels(other)];
	const mixed = a.map((channel, i) => Math.round(channel + (b[i] - channel) * amount));
	return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** White, or black on a light colour, as Instagram writes on a background. */
function onColor(hex: string): string {
	return luminance(hex) > 0.5 ? '#000000' : '#ffffff';
}

interface Paint {
	fill: string;
	/** Behind the lines, and how opaque. */
	box?: string;
	boxAlpha?: number;
	stroke?: string;
	/** Hard shadows, the nearest first. */
	shadows?: string[];
	glow?: string;
}

function paintOf(layer: TextLayer): Paint {
	const color = layer.color;
	// A neon tube: nearly white, lit in its colour.
	if (FONTS[layer.font].glow) return { fill: mix(color, '#ffffff', 0.7), glow: color };
	const on = onColor(color);
	switch (layer.mode) {
		case 'box':
			return { fill: on, box: color, boxAlpha: 1 };
		case 'soft':
			return { fill: on, box: color, boxAlpha: 0.6 };
		case 'outline':
			return { fill: on, stroke: color };
		case 'shadow':
			return { fill: on, shadows: [color, mix(color, '#000000', 0.45)] };
		default:
			return { fill: color };
	}
}

// ——— Layout

interface Line {
	text: string;
	/** Where its text starts and its baseline, from the middle of the block. */
	x: number;
	y: number;
	width: number;
}

interface Rect {
	l: number;
	r: number;
	t: number;
	b: number;
}

/** A text laid out at the reference width, around its middle. */
interface Shape {
	font: string;
	size: number;
	tracking: number;
	lines: Line[];
	/** Each line's background, drawn or not: also what a finger finds the text by. */
	rects: Rect[];
}

let measurer: CanvasRenderingContext2D | null | undefined;
let segmenter: Intl.Segmenter | undefined;

function measuring(): CanvasRenderingContext2D {
	measurer ??= document.createElement('canvas').getContext('2d');
	if (!measurer) throw new Error('No se pudo preparar el texto.');
	return measurer;
}

/** What a reader takes for one character: an emoji with its skin tone is one. */
function graphemes(text: string): string[] {
	if (typeof Intl.Segmenter !== 'function') return Array.from(text);
	segmenter ??= new Intl.Segmenter('es', { granularity: 'grapheme' });
	return Array.from(segmenter.segment(text), ({ segment }) => segment);
}

/** Whether a canvas spaces letters by itself; not every browser's does. */
function spaces(context: CanvasRenderingContext2D): boolean {
	return 'letterSpacing' in context;
}

function widthOf(context: CanvasRenderingContext2D, text: string, tracking: number): number {
	if (!tracking) return context.measureText(text).width;
	if (spaces(context)) {
		context.letterSpacing = `${tracking}px`;
		const width = context.measureText(text).width;
		context.letterSpacing = '0px';
		return width;
	}
	// As CSS does, the spacing goes after every letter, the last one too.
	return graphemes(text).reduce((sum, letter) => sum + context.measureText(letter).width + tracking, 0);
}

function fontOf(font: Font, size: number): string {
	return `${font.italic ? 'italic ' : ''}${font.weight} ${size}px ${font.family}`;
}

/**
 * A paragraph broken into lines no wider than `room`, where CSS breaks the one being typed (with
 * `white-space: pre-wrap` and `overflow-wrap: anywhere`): between words, the spaces staying at the
 * end of the line they leave, and a word wider than a whole line wherever it no longer fits.
 */
function wrap(paragraph: string, room: number, measure: (text: string) => number): string[] {
	const rows: string[] = [];
	let row = '';
	for (const piece of paragraph.split(/( +)/)) {
		if (!piece) continue;
		if (piece.startsWith(' ')) {
			row += piece;
			continue;
		}
		if (row.trim() && measure(row + piece) > room) {
			rows.push(row);
			row = '';
		}
		let word = piece;
		while (measure(row + word) > room) {
			const letters = graphemes(word);
			let fit = 0;
			while (fit < letters.length && measure(row + letters.slice(0, fit + 1).join('')) <= room) fit++;
			// Not even one letter fits next to what is there: the line ends before it. And one letter
			// wider than the room still gets a line of its own.
			if (fit === 0 && row) {
				rows.push(row);
				row = '';
				continue;
			}
			fit ||= 1;
			rows.push(row + letters.slice(0, fit).join(''));
			row = '';
			word = letters.slice(fit).join('');
		}
		row += word;
	}
	rows.push(row);
	return rows.map((text) => text.trimEnd());
}

function lay(layer: TextLayer): Shape {
	const font = FONTS[layer.font];
	const size = layer.size * (font.zoom ?? 1) * REFERENCE;
	const tracking = (font.tracking ?? 0) * size;
	const context = measuring();
	context.font = fontOf(font, size);
	const measure = (text: string) => widthOf(context, text, tracking);

	const padX = PAD_X * size;
	const padY = PAD_Y * size;
	const room = WRAP * REFERENCE - 2 * padX;
	const text = font.caps ? layer.text.toLocaleUpperCase('es') : layer.text;
	const rows: string[] = [];
	let wrapped = false;
	for (const paragraph of text.split('\n')) {
		const broken = wrap(paragraph, room, measure);
		wrapped ||= broken.length > 1;
		rows.push(...broken);
	}
	const widths = rows.map(measure);
	// As wide as the longest line, or, once one has wrapped, as the whole room: what CSS makes of
	// the field it is typed in, which a left or right alignment lines up against.
	const inner = wrapped ? room : Math.max(0, ...widths);

	// The font's own ascent and descent, which CSS centres in each line too.
	const metrics = context.measureText('M');
	const ascent = metrics.fontBoundingBoxAscent ?? size * 0.8;
	const descent = metrics.fontBoundingBoxDescent ?? size * 0.2;
	const leading = font.leading * size;
	const top = (-rows.length * leading) / 2;

	const lines = rows.map((row, i): Line => {
		const width = widths[i];
		const x =
			layer.align === 'left' ? -inner / 2 : layer.align === 'right' ? inner / 2 - width : -width / 2;
		const y = top + i * leading + (leading - ascent - descent) / 2 + ascent;
		return { text: row, x, y, width };
	});
	const rects = lines.map(({ x, y, width }) => ({
		l: x - padX,
		r: x + width + padX,
		t: y - ascent - padY,
		b: y + descent + padY
	}));
	return { font: context.font, size, tracking, lines, rects };
}

const shapes = new Map<string, Shape>();

/** Laid out once for each text, font, size and alignment: a drag draws it again on every move. */
function shapeOf(layer: TextLayer): Shape {
	const key = JSON.stringify([layer.text, layer.font, layer.size, layer.align]);
	let shape = shapes.get(key);
	if (!shape) {
		if (shapes.size > 100) shapes.clear();
		shape = lay(layer);
		shapes.set(key, shape);
	}
	return shape;
}

/** Forgets every layout: a font that arrived late measures differently. */
export function relayout() {
	shapes.clear();
}

// ——— Drawing

/**
 * The backgrounds of the lines that touch, as one shape, the way TikTok draws them: each line's
 * box meets the next one halfway through where they overlap, edges a little apart are evened
 * out, and every corner is rounded, the inner ones too. A blank line starts another shape.
 */
function backgrounds(context: CanvasRenderingContext2D, shape: Shape) {
	const runs: Rect[][] = [];
	let run: Rect[] = [];
	for (const [i, line] of shape.lines.entries()) {
		if (line.text) {
			run.push({ ...shape.rects[i] });
		} else if (run.length) {
			runs.push(run);
			run = [];
		}
	}
	if (run.length) runs.push(run);

	const radius = RADIUS * shape.size;
	for (const rects of runs) {
		for (let i = 1; i < rects.length; i++) {
			const middle = (rects[i - 1].b + rects[i].t) / 2;
			rects[i - 1].b = middle;
			rects[i].t = middle;
		}
		for (let changed = true; changed; ) {
			changed = false;
			for (let i = 1; i < rects.length; i++) {
				const [above, below] = [rects[i - 1], rects[i]];
				if (above.r !== below.r && Math.abs(above.r - below.r) < radius) {
					above.r = below.r = Math.max(above.r, below.r);
					changed = true;
				}
				if (above.l !== below.l && Math.abs(above.l - below.l) < radius) {
					above.l = below.l = Math.min(above.l, below.l);
					changed = true;
				}
			}
		}

		// Clockwise round the outline: down the right side, step by step, and back up the left.
		const first = rects[0];
		const last = rects[rects.length - 1];
		const points: number[][] = [
			[first.l, first.t],
			[first.r, first.t]
		];
		for (let i = 0; i < rects.length; i++) {
			points.push([rects[i].r, rects[i].b]);
			if (i + 1 < rects.length) points.push([rects[i + 1].r, rects[i].b]);
		}
		points.push([last.l, last.b]);
		for (let i = rects.length - 1; i > 0; i--) {
			points.push([rects[i].l, rects[i].t], [rects[i - 1].l, rects[i].t]);
		}
		// Two lines of the same width leave points along a straight edge: they are no corners.
		const corners = points.filter((point, i) => {
			const before = points[(i + points.length - 1) % points.length];
			const after = points[(i + 1) % points.length];
			const [dx1, dy1] = [point[0] - before[0], point[1] - before[1]];
			const [dx2, dy2] = [after[0] - point[0], after[1] - point[1]];
			const turn = dx1 * dy2 - dy1 * dx2;
			return Math.abs(turn) > 1e-6;
		});

		const at = (i: number) => corners[(i + corners.length) % corners.length];
		const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
		context.moveTo((at(-1)[0] + at(0)[0]) / 2, (at(-1)[1] + at(0)[1]) / 2);
		for (let i = 0; i < corners.length; i++) {
			const [before, corner, after] = [at(i - 1), at(i), at(i + 1)];
			const round = Math.min(radius, distance(before, corner) / 2, distance(corner, after) / 2);
			context.arcTo(corner[0], corner[1], after[0], after[1], round);
		}
		context.closePath();
	}
}

function drawLine(
	context: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	tracking: number,
	stroke: boolean
) {
	const draw = (part: string, at: number) =>
		stroke ? context.strokeText(part, at, y) : context.fillText(part, at, y);
	if (!tracking) return draw(text, x);
	if (spaces(context)) {
		context.letterSpacing = `${tracking}px`;
		draw(text, x);
		context.letterSpacing = '0px';
		return;
	}
	for (const letter of graphemes(text)) {
		draw(letter, x);
		x += context.measureText(letter).width + tracking;
	}
}

/** One text, around the origin, in reference units; `pixels` is how many pixels one of them takes. */
function drawLayer(context: CanvasRenderingContext2D, layer: TextLayer, pixels: number) {
	const shape = shapeOf(layer);
	const paint = paintOf(layer);
	const { size } = shape;
	const each = (stroke: boolean, offset = 0) => {
		for (const { text, x, y } of shape.lines) {
			if (text) drawLine(context, text, x + offset, y + offset, shape.tracking, stroke);
		}
	};
	context.font = shape.font;
	context.textAlign = 'left';
	context.textBaseline = 'alphabetic';

	if (paint.box) {
		context.save();
		context.globalAlpha *= paint.boxAlpha ?? 1;
		context.fillStyle = paint.box;
		context.beginPath();
		backgrounds(context, shape);
		context.fill();
		context.restore();
	}
	if (paint.glow) {
		context.save();
		context.fillStyle = paint.glow;
		context.shadowColor = paint.glow;
		// A shadow's blur is in the canvas's pixels, whatever the transform: scaled by hand.
		for (const blur of [0.5, 0.25, 0.08]) {
			context.shadowBlur = blur * size * pixels;
			each(false);
		}
		context.restore();
	}
	if (paint.stroke) {
		context.strokeStyle = paint.stroke;
		context.lineWidth = STROKE * size;
		context.lineJoin = 'round';
		each(true);
	}
	if (paint.shadows) {
		// Drawn as offset copies rather than as canvas shadows, so that they turn with the text.
		for (let i = paint.shadows.length; i > 0; i--) {
			context.fillStyle = paint.shadows[i - 1];
			each(false, i * 0.05 * size);
		}
	}
	context.fillStyle = paint.fill;
	each(false);
}

/**
 * Draws the texts on a frame `width` by `height` pixels of the canvas, in their order: the last is
 * on top. `skip` leaves out the one being typed; `faded` shows one about to be thrown away.
 */
export function drawTexts(
	context: CanvasRenderingContext2D,
	layers: readonly TextLayer[],
	width: number,
	height: number,
	{ skip, faded }: { skip?: string; faded?: string } = {}
) {
	const unit = width / REFERENCE;
	for (const layer of layers) {
		if (layer.id === skip || !layer.text.trim()) continue;
		context.save();
		context.translate(layer.x * width, layer.y * height);
		context.rotate(layer.angle);
		context.scale(unit * layer.scale, unit * layer.scale);
		if (layer.id === faded) context.globalAlpha = 0.35;
		drawLayer(context, layer, unit * layer.scale);
		context.restore();
	}
}

/** Whether a point of a frame `width` by `height`, in its pixels, is on the text or `slop` pixels from it. */
export function hits(layer: TextLayer, x: number, y: number, width: number, height: number, slop: number) {
	const unit = (width / REFERENCE) * layer.scale;
	const dx = x - layer.x * width;
	const dy = y - layer.y * height;
	const [cos, sin] = [Math.cos(layer.angle), Math.sin(layer.angle)];
	// Turned back, and in the units it was laid out in.
	const lx = (dx * cos + dy * sin) / unit;
	const ly = (dy * cos - dx * sin) / unit;
	const reach = slop / unit;
	const { lines, rects } = shapeOf(layer);
	return rects.some(
		(rect, i) =>
			lines[i].text &&
			lx >= rect.l - reach &&
			lx <= rect.r + reach &&
			ly >= rect.t - reach &&
			ly <= rect.b + reach
	);
}

// ——— CSS, for the text while it is typed

/** A font's button: its name in the font itself. */
export function fontStyle(id: FontId): string {
	const font = FONTS[id];
	return [
		`font-family: ${font.family}`,
		`font-weight: ${font.weight}`,
		`font-style: ${font.italic ? 'italic' : 'normal'}`,
		`text-transform: ${font.caps ? 'uppercase' : 'none'}`,
		`letter-spacing: ${font.tracking ?? 0}em`
	].join('; ');
}

/**
 * The text as CSS draws it while it is typed, with `width` pixels for the frame's width: the same
 * font, size, colours and effects the canvas gives it once it is placed, and the same line breaks.
 * It takes two layers, laid out alike by `font`: the field, which `field` gives the room each line's
 * background takes and colours, and a copy of it underneath that draws the backgrounds, `box` on
 * each of its lines. `boxOpacity` goes on that copy as a whole, so that a see-through background
 * is no darker where two lines overlap.
 */
export function typedStyle(layer: TextLayer, width: number) {
	const font = FONTS[layer.font];
	const paint = paintOf(layer);
	const shadows: string[] = [];
	if (paint.glow) shadows.push(...[0.08, 0.25, 0.5].map((blur) => `0 0 ${blur}em ${paint.glow}`));
	for (const [i, color] of (paint.shadows ?? []).entries()) {
		shadows.push(`${(i + 1) * 0.05}em ${(i + 1) * 0.05}em 0 ${color}`);
	}
	const field = [
		// As much as a background takes on either side, whether there is one or not, so that the
		// lines break the same either way.
		`padding: 0 ${PAD_X}em`,
		`color: ${paint.fill}`,
		`caret-color: ${paint.fill}`,
		paint.stroke ? `-webkit-text-stroke: ${STROKE}em ${paint.stroke}; paint-order: stroke fill` : '',
		shadows.length ? `text-shadow: ${shadows.join(', ')}` : ''
	];
	return {
		font: [
			fontStyle(layer.font),
			`font-size: ${layer.size * (font.zoom ?? 1) * width}px`,
			`line-height: ${font.leading}`
		].join('; '),
		field: field.filter(Boolean).join('; '),
		box: [
			`padding: ${PAD_Y}em ${PAD_X}em`,
			`border-radius: ${RADIUS}em`,
			`background-color: ${paint.box ?? 'transparent'}`
		].join('; '),
		boxOpacity: paint.boxAlpha ?? 1,
		maxWidth: WRAP * width
	};
}
