// Rasterizes each project's icon.svg into the apple-touch-icon.png that iOS needs.
//
// Safari only reads a raster image for the home screen icon: it ignores `icon.svg`, both as
// `apple-touch-icon` and from a manifest. Without the PNG, «Agregar a pantalla de inicio»
// saves a screenshot of the page instead of the icon.
//
// The PNGs are generated, never committed: `icon.svg` stays the only source of truth.
// Run with `pnpm icons`; scripts/build.mjs does it too.

import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** The largest size iOS asks for (iPhone @3x). It downsamples this one for every other slot. */
const size = 180;

/**
 * The apple-touch-icon.png for a square, full-bleed SVG: iOS applies the rounded mask itself, and
 * renders anything transparent as black.
 */
export function appleTouchIcon(svg) {
	return new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: '#fff' }).render().asPng();
}

/** Writes `<project>/static/apple-touch-icon.png`. */
function writeAppleTouchIcon(svg, projectDir) {
	const out = join(projectDir, 'static', 'apple-touch-icon.png');
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, appleTouchIcon(readFileSync(svg, 'utf8')));
	return out;
}

/** The home screen plus every app: each one is published on its own path and needs its own icon. */
function projects() {
	const appsDir = join(root, 'apps');

	return [
		{ dir: join(root, 'home'), svg: join(root, 'home', 'src', 'lib', 'icon.svg') },
		...readdirSync(appsDir, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
			.map(({ name }) => ({ dir: join(appsDir, name), svg: join(appsDir, name, 'icon.svg') }))
	];
}

export function writeIcons() {
	return projects().map(({ dir, svg }) => writeAppleTouchIcon(svg, dir));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	for (const file of writeIcons()) console.log(`✔ ${relative(root, file)}`);
}
