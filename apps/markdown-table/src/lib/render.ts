// Draws a table as a PNG, in one of the styles of `styles.ts`, on a canvas: the image is exactly what
// the preview shows, since the preview is that same PNG.
//
// Every cell is measured with the font it is drawn in, its own Markdown read (`inline.ts`): columns
// are as wide as their longest cell, up to a limit past which a cell wraps onto more lines, and a
// row is as tall as its tallest cell.
import { inline, type Run } from './inline';
import { graphemes, type Align, type TableData } from './markdown';
import type { Lines, Sizes, Style } from './styles';

const FAMILIES = {
	sans: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
	serif: "ui-serif, 'New York', Georgia, Cambria, 'Times New Roman', serif",
	mono: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace"
};

/** Of the text, times its size. */
const LINE_HEIGHT = 1.45;

/** How narrow a column's text may get. How wide, before it wraps, the caller says. */
const MIN_TEXT = 24;

/** Room on either side of a piece of code, inside its background. */
const CODE_PAD = 4;

/** The height of a window's bar, with its three buttons. */
const BAR = 40;

/** How many image pixels a CSS pixel is: three, as an iPhone's screen. */
const MAX_SCALE = 3;

/**
 * iOS will not draw on a canvas of more than 16,777,216 pixels, and browsers cap a side: past
 * either, a large table is drawn at a smaller scale rather than not at all.
 */
const MAX_AREA = 16_000_000;
const MAX_SIDE = 16_384;

interface Piece {
	text: string;
	run: Run;
	font: string;
	/** The text's own, plus a piece of code's room on either side. */
	width: number;
	/** Where the text starts inside it. */
	inset: number;
	space: boolean;
}

interface Placed extends Piece {
	x: number;
}

interface Line {
	pieces: Placed[];
	width: number;
}

export interface Image {
	blob: Blob;
	/** In pixels. */
	width: number;
	height: number;
	/** Pixels per CSS pixel: what the width is divided by to show it at its size. */
	scale: number;
}

class Measure {
	#context: CanvasRenderingContext2D;
	#cache = new Map<string, number>();

	constructor(context: CanvasRenderingContext2D) {
		this.#context = context;
	}

	width(text: string, font: string, spacing: string): number {
		const key = `${font}\u0000${spacing}\u0000${text}`;
		let width = this.#cache.get(key);
		if (width === undefined) {
			setFont(this.#context, font, spacing);
			width = this.#context.measureText(text).width;
			this.#cache.set(key, width);
		}
		return width;
	}
}

function setFont(context: CanvasRenderingContext2D, font: string, spacing: string) {
	context.font = font;
	// Where it is not supported it is not measured either, so the layout still adds up.
	if ('letterSpacing' in context) context.letterSpacing = spacing;
}

function fontOf(style: Style, sizes: Sizes, run: Run, header: boolean): string {
	const family = run.code ? FAMILIES.mono : FAMILIES[style.font];
	let size = header ? sizes.header : sizes.body;
	if (run.code && style.font !== 'mono') size *= 0.88;
	const weight = header ? Math.max(style.header.weight, run.bold ? 700 : 0) : run.bold ? 700 : 400;
	return `${run.italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;
}

function spacingOf(style: Style, header: boolean): string {
	return header && style.header.caps ? '0.06em' : '0px';
}

/** A line of a cell as pieces to place: words, the spaces between them, and code with its room. */
function piecesOf(runs: Run[], style: Style, sizes: Sizes, header: boolean, measure: Measure): Piece[] {
	const spacing = spacingOf(style, header);
	const pieces: Piece[] = [];

	for (const run of runs) {
		const font = fontOf(style, sizes, run, header);
		const text = header && style.header.caps ? run.text.toLocaleUpperCase('es') : run.text;
		// A no-break space keeps the words around it together, as it does on a page.
		const tokens = text.match(/[ \t\n]+|[^ \t\n]+/g) ?? [];

		tokens.forEach((token, index) => {
			const space = /^[ \t\n]/.test(token);
			const shown = space ? ' ' : token;
			const pad = run.code ? CODE_PAD : 0;
			const before = index === 0 ? pad : 0;
			const after = index === tokens.length - 1 ? pad : 0;
			pieces.push({
				text: shown,
				run,
				font,
				width: measure.width(shown, font, spacing) + before + after,
				inset: before,
				space
			});
		});
	}
	return pieces;
}

/** The pieces in lines no wider than `max`, a word too long for one broken where it has to be. */
function wrap(pieces: Piece[], max: number, measure: Measure, spacing: string): Line[] {
	const lines: Line[] = [];
	let line: Placed[] = [];
	let x = 0;

	const end = () => {
		// A line does not end on a space: it would push a line lined up on the right off its edge.
		while (line.at(-1)?.space) x -= line.pop()!.width;
		lines.push({ pieces: line, width: x });
		line = [];
		x = 0;
	};
	const place = (piece: Piece) => {
		line.push({ ...piece, x });
		x += piece.width;
	};

	for (const piece of pieces) {
		if (piece.space) {
			if (x > 0) place(piece);
			continue;
		}
		if (x > 0 && x + piece.width > max) end();
		if (piece.width <= max) {
			place(piece);
			continue;
		}

		let chunk = '';
		for (const grapheme of graphemes(piece.text)) {
			const next = chunk + grapheme;
			if (chunk && measure.width(next, piece.font, spacing) + piece.inset > max) {
				place({ ...piece, text: chunk, width: measure.width(chunk, piece.font, spacing) + piece.inset });
				end();
				chunk = grapheme;
			} else chunk = next;
		}
		place({ ...piece, text: chunk, width: measure.width(chunk, piece.font, spacing) + piece.inset });
	}
	end();
	return lines;
}

interface Layout {
	/** Per row, per cell: its lines as they are drawn. */
	cells: Line[][][];
	columns: number[];
	rows: number[];
	/** Per row: the header's text and the body's may be of different sizes. */
	lineHeights: number[];
	/** Per row, the size of its text. */
	sizes: number[];
	width: number;
	height: number;
	/** Of the window's bar, 0 for none. */
	bar: number;
}

function layout(table: TableData, style: Style, textSizes: Sizes, column: number, measure: Measure): Layout {
	const read = table.cells.map((row, index) =>
		row.map((cell) => inline(cell).map((runs) => piecesOf(runs, style, textSizes, index === 0, measure)))
	);

	// How wide each cell would be with nothing wrapped: its longest line.
	const natural = read.map((row, index) =>
		row.map((lines) =>
			Math.max(...lines.map((pieces) => wrap(pieces, Infinity, measure, spacingOf(style, index === 0))[0].width))
		)
	);
	// The column's width is the user's to set, its padding included: larger text wraps sooner rather
	// than widening the image, which would only be shown smaller.
	const most = Math.max(MIN_TEXT, column - 2 * style.padding.x);
	const columns = table.align.map((_, column) => {
		const longest = Math.max(0, ...natural.map((row) => row[column]));
		return Math.ceil(Math.min(most, Math.max(MIN_TEXT, longest)));
	});

	const cells = read.map((row, index) =>
		row.map((lines, column) =>
			lines.flatMap((pieces) => wrap(pieces, columns[column], measure, spacingOf(style, index === 0)))
		)
	);

	const sizes = cells.map((_, index) => (index === 0 ? textSizes.header : textSizes.body));
	const lineHeights = sizes.map((size) => Math.round(size * LINE_HEIGHT));
	const rows = cells.map(
		(row, index) => Math.max(...row.map((lines) => lines.length)) * lineHeights[index] + 2 * style.padding.y
	);
	const bar = style.window ? BAR : 0;

	return {
		cells,
		columns: columns.map((width) => width + 2 * style.padding.x),
		rows,
		lineHeights,
		sizes,
		width: columns.reduce((sum, width) => sum + width + 2 * style.padding.x, 0),
		height: bar + rows.reduce((sum, height) => sum + height, 0),
		bar
	};
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	const radius = Math.max(0, Math.min(r, w / 2, h / 2));
	context.beginPath();
	context.moveTo(x + radius, y);
	context.arcTo(x + w, y, x + w, y + h, radius);
	context.arcTo(x + w, y + h, x, y + h, radius);
	context.arcTo(x, y + h, x, y, radius);
	context.arcTo(x, y, x + w, y, radius);
	context.closePath();
}

function stroke(context: CanvasRenderingContext2D, lines: Pick<Lines, 'color' | 'width' | 'dash'>, path: () => void) {
	context.save();
	context.strokeStyle = lines.color;
	context.lineWidth = lines.width;
	context.setLineDash(lines.dash ?? []);
	context.beginPath();
	path();
	context.stroke();
	context.restore();
}

function drawFrame(context: CanvasRenderingContext2D, style: Style, width: number, height: number) {
	const frame = style.frame;
	if (!frame) return;

	if (Array.isArray(frame.background)) {
		const gradient = context.createLinearGradient(0, 0, width, height);
		frame.background.forEach((color, index, all) => gradient.addColorStop(index / (all.length - 1), color));
		context.fillStyle = gradient;
	} else context.fillStyle = frame.background;
	context.fillRect(0, 0, width, height);

	if (frame.grid) {
		const step = 20;
		stroke(context, { color: frame.grid, width: 1 }, () => {
			for (let x = step; x < width; x += step) {
				context.moveTo(x, 0);
				context.lineTo(x, height);
			}
			for (let y = step; y < height; y += step) {
				context.moveTo(0, y);
				context.lineTo(width, y);
			}
		});
	}
}

/** The bar of a window: its three buttons on the left and the table's name in the middle. */
function drawBar(context: CanvasRenderingContext2D, style: Style, width: number, title: string, measure: Measure) {
	const window = style.window!;
	context.fillStyle = window.background;
	context.fillRect(0, 0, width, BAR);

	['#ff5f57', '#febc2e', '#28c840'].forEach((color, index) => {
		context.fillStyle = color;
		context.beginPath();
		context.arc(20 + index * 20, BAR / 2, 6, 0, Math.PI * 2);
		context.fill();
	});

	const name = title.trim();
	if (!name) return;
	const font = `600 13px ${FAMILIES.sans}`;
	const room = width - 2 * 84;
	if (room < 40) return;

	let shown = name;
	if (measure.width(shown, font, '0px') > room) {
		const letters = graphemes(name);
		while (letters.length && measure.width(`${letters.join('')}…`, font, '0px') > room) letters.pop();
		shown = `${letters.join('').trimEnd()}…`;
	}
	setFont(context, font, '0px');
	context.fillStyle = window.text;
	context.textBaseline = 'middle';
	context.textAlign = 'center';
	context.fillText(shown, width / 2, BAR / 2);
	context.textAlign = 'left';
}

function drawLines(context: CanvasRenderingContext2D, style: Style, layout: Layout) {
	const { lines, headerRule } = style;
	const { columns, rows, width, height, bar } = layout;
	const bottoms: number[] = [];
	rows.reduce((top, row) => (bottoms.push(top + row), top + row), bar);

	if (lines.vertical) {
		stroke(context, lines, () => {
			let x = 0;
			for (const column of columns.slice(0, -1)) {
				x += column;
				context.moveTo(x, bar);
				context.lineTo(x, height);
			}
		});
	}
	if (lines.horizontal) {
		stroke(context, lines, () => {
			for (const y of bottoms.slice(1, -1)) {
				context.moveTo(0, y);
				context.lineTo(width, y);
			}
		});
	}

	// Under the header: a rule of its own, or the grid's when there is one.
	const under = headerRule ?? (lines.horizontal || lines.vertical ? lines : undefined);
	if (under && rows.length > 1) {
		stroke(context, under, () => {
			context.moveTo(0, bottoms[0]);
			context.lineTo(width, bottoms[0]);
		});
	}

	if (lines.outer === 'box') {
		const inset = lines.width / 2;
		stroke(context, lines, () => {
			roundedRect(context, inset, inset, width - lines.width, height - lines.width, style.radius - inset);
		});
	} else if (lines.outer === 'rules') {
		const inset = lines.width / 2;
		stroke(context, lines, () => {
			context.moveTo(0, bar + inset);
			context.lineTo(width, bar + inset);
			context.moveTo(0, height - inset);
			context.lineTo(width, height - inset);
		});
	}
}

function startOf(align: Align, column: number, line: number, padding: number): number {
	if (align === 'center') return (column - line) / 2;
	if (align === 'right') return column - padding - line;
	return padding;
}

function drawText(context: CanvasRenderingContext2D, style: Style, layout: Layout, align: Align[]) {
	context.textBaseline = 'middle';

	let top = layout.bar;
	layout.cells.forEach((row, index) => {
		const header = index === 0;
		const spacing = spacingOf(style, header);
		const lineHeight = layout.lineHeights[index];
		const size = layout.sizes[index];
		let left = 0;

		row.forEach((lines, column) => {
			lines.forEach((line, number) => {
				const x = left + startOf(align[column], layout.columns[column], line.width, style.padding.x);
				const y = top + style.padding.y + number * lineHeight + lineHeight / 2;

				// Code first, its background under every piece of it in a row.
				for (let i = 0; i < line.pieces.length; i++) {
					if (!line.pieces[i].run.code) continue;
					let j = i;
					while (j + 1 < line.pieces.length && line.pieces[j + 1].run === line.pieces[i].run) j++;
					const start = line.pieces[i].x;
					const end = line.pieces[j].x + line.pieces[j].width;
					context.fillStyle = style.code.background;
					roundedRect(context, x + start, y - size * 0.68, end - start, size * 1.36, 5);
					context.fill();
					i = j;
				}

				for (const piece of line.pieces) {
					const { run } = piece;
					context.fillStyle = run.code
						? style.code.text
						: run.link
							? style.link
							: header
								? style.header.text
								: style.text;
					if (piece.space && !run.strike && !run.link) continue;

					const at = x + piece.x;
					if (!piece.space) {
						setFont(context, piece.font, spacing);
						context.fillText(piece.text, at + piece.inset, y);
					}
					const thickness = Math.max(1, size / 14);
					if (run.strike) context.fillRect(at, y - thickness / 2, piece.width, thickness);
					if (run.link) context.fillRect(at, y + size * 0.55, piece.width, thickness);
				}
			});
			left += layout.columns[column];
		});
		top += layout.rows[index];
	});
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.'))), 'image/png')
	);
}

/**
 * The table as a PNG, in the style given, its text at `sizes` and no column wider than `column`
 * (padding included) unless a single word needs it; `title` names it in a window's bar.
 */
export async function render(
	table: TableData,
	style: Style,
	sizes: Sizes,
	column: number,
	title: string
): Promise<Image> {
	const canvas = document.createElement('canvas');
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Este navegador no puede crear imágenes.');

	const measure = new Measure(context);
	const laid = layout(table, style, sizes, column, measure);
	const padding = style.frame?.padding ?? 0;
	const width = laid.width + 2 * padding;
	const height = laid.height + 2 * padding;

	const scale = Math.max(0.5, Math.min(MAX_SCALE, Math.sqrt(MAX_AREA / (width * height)), MAX_SIDE / Math.max(width, height)));
	canvas.width = Math.round(width * scale);
	canvas.height = Math.round(height * scale);
	context.scale(scale, scale);

	drawFrame(context, style, width, height);
	context.translate(padding, padding);

	if (style.shadow) {
		context.save();
		context.shadowColor = style.shadow.color;
		context.shadowBlur = style.shadow.blur;
		context.shadowOffsetY = style.shadow.y;
		context.fillStyle = style.background;
		roundedRect(context, 0, 0, laid.width, laid.height, style.radius);
		context.fill();
		context.restore();
	}

	context.save();
	roundedRect(context, 0, 0, laid.width, laid.height, style.radius);
	context.clip();

	context.fillStyle = style.background;
	context.fillRect(0, 0, laid.width, laid.height);
	if (style.window) drawBar(context, style, laid.width, title, measure);

	context.fillStyle = style.header.background;
	context.fillRect(0, laid.bar, laid.width, laid.rows[0]);
	if (style.stripe) {
		context.fillStyle = style.stripe;
		let top = laid.bar;
		laid.rows.forEach((height, index) => {
			if (index > 0 && index % 2 === 0) context.fillRect(0, top, laid.width, height);
			top += height;
		});
	}

	drawLines(context, style, laid);
	drawText(context, style, laid, table.align);
	context.restore();

	try {
		return { blob: await toBlob(canvas), width: canvas.width, height: canvas.height, scale };
	} finally {
		// iOS keeps a canvas's memory until it is emptied, however long ago it was let go.
		canvas.width = canvas.height = 0;
	}
}
