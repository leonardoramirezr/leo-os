// The looks a table's image can have. Each is all the renderer (`render.ts`) needs to draw it, and a
// table keeps the one picked for it by its id — so an id, once published, stays.
//
// Sizes are in CSS pixels; the image is drawn at three times that, or less for a table too large.

export interface Lines {
	color: string;
	width: number;
	/** Between columns. */
	vertical: boolean;
	/** Between the rows of the body. */
	horizontal: boolean;
	/**
	 * Around the table: `box` all the way round, `rules` above and below only, as a book prints
	 * a table; `none` for neither.
	 */
	outer: 'box' | 'rules' | 'none';
	/** Dashes, for a table drawn on a terminal. */
	dash?: number[];
}

export interface Style {
	id: string;
	/** As the picker shows it. */
	name: string;
	font: 'sans' | 'serif' | 'mono';
	size: number;
	/**
	 * Room around the table, filled with a colour or a gradient from the top left corner to the
	 * bottom right one. None leaves the image cut right at the table's edges.
	 */
	frame?: { padding: number; background: string | string[]; grid?: string };
	/** A window's bar above the table, its three buttons and the table's name. */
	window?: { background: string; text: string };
	/** Of the table's corners. Outside them, the image is transparent. */
	radius: number;
	/** Cast by the table on its frame. */
	shadow?: { color: string; blur: number; y: number };
	padding: { x: number; y: number };
	background: string;
	text: string;
	header: {
		background: string;
		text: string;
		weight: number;
		/** Smaller and in capitals, with some room between the letters. */
		caps?: boolean;
	};
	/** Every other row of the body, starting with the second. */
	stripe?: string;
	lines: Lines;
	/** The line under the header, when it is not like the others. */
	headerRule?: { color: string; width: number };
	code: { background: string; text: string };
	link: string;
}

export const styles: Style[] = [
	{
		id: 'classic',
		name: 'Clásico',
		font: 'sans',
		size: 15,
		radius: 0,
		padding: { x: 13, y: 8 },
		background: '#ffffff',
		text: '#1f2328',
		header: { background: '#f6f8fa', text: '#1f2328', weight: 600 },
		lines: { color: '#d1d9e0', width: 1, vertical: true, horizontal: true, outer: 'box' },
		code: { background: '#eff1f3', text: '#1f2328' },
		link: '#0969da'
	},
	{
		id: 'dark',
		name: 'Oscuro',
		font: 'sans',
		size: 15,
		radius: 0,
		padding: { x: 13, y: 8 },
		background: '#0d1117',
		text: '#e6edf3',
		header: { background: '#151b23', text: '#f0f6fc', weight: 600 },
		lines: { color: '#3d444d', width: 1, vertical: true, horizontal: true, outer: 'box' },
		code: { background: '#2f353d', text: '#e6edf3' },
		link: '#4493f8'
	},
	{
		id: 'minimal',
		name: 'Minimal',
		font: 'sans',
		size: 15,
		frame: { padding: 28, background: '#ffffff' },
		radius: 0,
		padding: { x: 18, y: 12 },
		background: '#ffffff',
		text: '#111827',
		header: { background: '#ffffff', text: '#6b7280', weight: 600, caps: true },
		lines: { color: '#eceef1', width: 1, vertical: false, horizontal: true, outer: 'none' },
		headerRule: { color: '#111827', width: 1.5 },
		code: { background: '#f3f4f6', text: '#111827' },
		link: '#2563eb'
	},
	{
		id: 'stripes',
		name: 'Rayas',
		font: 'sans',
		size: 15,
		frame: { padding: 32, background: '#eef2f7' },
		radius: 14,
		shadow: { color: 'rgba(15, 23, 42, 0.12)', blur: 24, y: 6 },
		padding: { x: 16, y: 11 },
		background: '#ffffff',
		text: '#0f172a',
		header: { background: '#2563eb', text: '#ffffff', weight: 600 },
		stripe: '#eff5ff',
		lines: { color: '#e2e8f0', width: 1, vertical: false, horizontal: false, outer: 'none' },
		code: { background: '#e0e9fb', text: '#1e3a8a' },
		link: '#2563eb'
	},
	{
		id: 'card',
		name: 'Tarjeta',
		font: 'sans',
		size: 15,
		frame: { padding: 56, background: ['#a18cd1', '#fbc2eb'] },
		radius: 18,
		shadow: { color: 'rgba(55, 20, 90, 0.25)', blur: 40, y: 14 },
		padding: { x: 18, y: 12 },
		background: '#ffffff',
		text: '#1f1640',
		header: { background: '#ffffff', text: '#6d28d9', weight: 700 },
		lines: { color: '#f1edf9', width: 1, vertical: false, horizontal: true, outer: 'none' },
		headerRule: { color: '#e4dcf7', width: 2 },
		code: { background: '#f3eefc', text: '#5b21b6' },
		link: '#7c3aed'
	},
	{
		id: 'window',
		name: 'Ventana',
		font: 'mono',
		size: 14,
		frame: { padding: 56, background: ['#4f46e5', '#0ea5e9'] },
		window: { background: '#181825', text: '#a6adc8' },
		radius: 12,
		shadow: { color: 'rgba(8, 10, 40, 0.4)', blur: 44, y: 16 },
		padding: { x: 16, y: 10 },
		background: '#1e1e2e',
		text: '#cdd6f4',
		header: { background: '#1e1e2e', text: '#cba6f7', weight: 700 },
		lines: { color: '#313244', width: 1, vertical: true, horizontal: true, outer: 'none' },
		headerRule: { color: '#45475a', width: 1.5 },
		code: { background: '#313244', text: '#f5c2e7' },
		link: '#89b4fa'
	},
	{
		id: 'paper',
		name: 'Papel',
		font: 'serif',
		size: 16,
		frame: { padding: 36, background: '#f7f1e3' },
		radius: 0,
		padding: { x: 18, y: 9 },
		background: '#f7f1e3',
		text: '#3b2f22',
		header: { background: '#f7f1e3', text: '#2a2017', weight: 700 },
		lines: { color: '#3b2f22', width: 1.75, vertical: false, horizontal: false, outer: 'rules' },
		headerRule: { color: '#3b2f22', width: 0.75 },
		code: { background: '#ece2cc', text: '#3b2f22' },
		link: '#8b4513'
	},
	{
		id: 'terminal',
		name: 'Terminal',
		font: 'mono',
		size: 14,
		frame: { padding: 28, background: '#0a0f0b' },
		radius: 0,
		padding: { x: 14, y: 8 },
		background: '#0a0f0b',
		text: '#4ade80',
		header: { background: '#0f1d13', text: '#bbf7d0', weight: 700 },
		lines: { color: '#2b6b40', width: 1, vertical: true, horizontal: true, outer: 'box', dash: [4, 3] },
		code: { background: '#123420', text: '#86efac' },
		link: '#a7f3d0'
	},
	{
		id: 'blueprint',
		name: 'Plano',
		font: 'mono',
		size: 14,
		frame: { padding: 32, background: '#1d4f9e', grid: 'rgba(255, 255, 255, 0.09)' },
		radius: 0,
		padding: { x: 14, y: 9 },
		background: '#1d4f9e',
		text: '#ffffff',
		header: { background: '#2a5fb0', text: '#ffffff', weight: 700 },
		lines: { color: 'rgba(255, 255, 255, 0.7)', width: 1, vertical: true, horizontal: true, outer: 'box' },
		code: { background: 'rgba(255, 255, 255, 0.16)', text: '#ffffff' },
		link: '#bfdbfe'
	}
];

export const DEFAULT_STYLE = styles[0].id;

/** The style kept under `id`, or the first one for an id that is not (or no longer) one. */
export function styleOf(id: string): Style {
	return styles.find((style) => style.id === id) ?? styles[0];
}

/** The image's text sizes, in CSS pixels: the header's and the body's. */
export interface Sizes {
	header: number;
	body: number;
}

/** How small and how large the user may make the image's text. */
export const MIN_SIZE = 8;
export const MAX_SIZE = 40;

/** A size the user set, kept within bounds; 0 (or anything that is not a size) for the style's own. */
export function sizeOf(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
	return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
}

/** The style's own sizes: a header in capitals is smaller than the body. */
export function defaultSizes(style: Style): Sizes {
	return { header: style.header.caps ? Math.round(style.size * 0.8) : style.size, body: style.size };
}

/** The sizes the image is drawn at: the user's where they set one, else the style's. */
export function sizesOf(style: Style, header: number, body: number): Sizes {
	const own = defaultSizes(style);
	return { header: sizeOf(header) || own.header, body: sizeOf(body) || own.body };
}
