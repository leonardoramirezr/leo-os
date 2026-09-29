export type Rgb = [r: number, g: number, b: number];

/** The band's colour until one is picked: the home screen's base colour, as app.html paints it. */
export const BUILT_IN_STATUS_BAR = '#1c1446';

/**
 * The grid of iOS's colour picker, row by row: greys from white to black, then twelve hues from
 * their darkest to their lightest.
 */
export const GRID = [
	'ffffff ebebeb d6d6d6 c2c2c2 adadad 999999 858585 707070 5c5c5c 474747 333333 000000',
	'003748 011d57 11053b 2e063d 3c071b 5c0701 5a1c00 583300 563d00 666100 4f5504 263e0f',
	'004d65 012f7b 1a0a52 450d59 551029 831100 7b2900 7a4a00 785800 8c8602 707607 38571a',
	'016e8f 0042a9 2c0977 61187c 791a3d b51a00 ad3e00 a96800 a67b01 c4bc00 9ba50e 4e7a27',
	'008cb4 0056d6 371a94 7a219e 99244f e22400 da5100 d38301 d19d01 f5ec00 c3d117 669d34',
	'00a1d8 0061fd 4d22b2 982abc b92d5d ff4015 ff6a00 ffab01 fcc700 fefb41 d9ec37 76bb40',
	'01c7fc 3a87fd 5e30eb be38f3 e63b7a ff6250 ff8648 feb43f fecb3e fff76b e4ef65 96d35f',
	'52d6fc 74a7ff 864ffe d357fe ee719e ff8c82 ffa57d ffc777 ffd977 fff994 eaf28f b1dd8b',
	'93e3fd a7c6ff b18cfe e292fe f4a4c0 ffb5af ffc5ab ffd9a8 fee4a8 fffbb9 f1f7b7 cde8b5',
	'cbf0ff d3e2ff d9c9fe efcafe f9d3e0 ffdad8 ffe2d6 ffecd4 fff2d5 fefcdd f6fadb deeed4'
].map((row) => row.split(' ').map((hex) => `#${hex}`));

export const GRID_COLUMNS = GRID[0].length;

export function isHex(value: string): boolean {
	return /^#[0-9a-f]{6}$/i.test(value);
}

export function toHex(rgb: Rgb): string {
	return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Reads a colour the way people write one: `#1c1446`, `1C1446` or `#14a`, and `rgb(28, 20, 70)`,
 * `28, 20, 70` or `28 20 70`. Anything else is `undefined`.
 */
export function parseColor(text: string): Rgb | undefined {
	const value = text.trim().toLowerCase();

	const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)?.[1];
	if (hex) {
		const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
		return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16)) as Rgb;
	}

	const numbers = /^(?:rgb\s*\()?\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*\)?$/.exec(value);
	if (numbers) {
		const rgb = numbers.slice(1).map(Number) as Rgb;
		if (rgb.every((channel) => channel <= 255)) return rgb;
	}
	return undefined;
}

/** Whether dark marks read better than white ones on this colour. */
export function isLight(hex: string): boolean {
	const [r, g, b] = parseColor(hex) ?? [0, 0, 0];
	return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

/** The colour for the band: the one picked, when it is one, or the built-in. */
export function statusBarColor(picked: string): string {
	return isHex(picked) ? picked.toLowerCase() : BUILT_IN_STATUS_BAR;
}

/**
 * Gives the band its colour: as `--status-bar`, which iOS 26 reads off the strip `Account` keeps
 * along the top edge, and as `theme-color`, which Safari before 26 and Chrome read instead.
 */
export function paintStatusBar(color: string) {
	document.documentElement.style.setProperty('--status-bar', color);
	document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', color);
}
