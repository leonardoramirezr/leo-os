// Light or dark, for the home screen and every app at once: the device's, or the one picked in the
// home screen's Ajustes.
//
// Each project writes its colours with `light-dark()` under `color-scheme: light dark`, so the device
// decides by itself. A picked theme is `data-theme` on <html>, which `Account` sets and whose rules
// narrow `color-scheme` to that one scheme — rules, not an inline style, because the build turns
// `light-dark()` into variables that only a `color-scheme` written in the CSS switches over.
import { setting } from './settings.svelte';

export type Theme = 'system' | 'light' | 'dark';

export const theme = setting<Theme>('leo-os:theme', 'system');

/** The media query each `theme-color` came with, before a picked theme rewrote it. */
const media = new WeakMap<HTMLMetaElement, string>();

export function applyTheme(value: Theme) {
	const root = document.documentElement;
	const picked = value === 'light' || value === 'dark' ? value : undefined;
	if (picked) root.dataset.theme = picked;
	else delete root.dataset.theme;

	// iOS colours the bar at the top with `theme-color`, which the apps give once per scheme and key
	// to the device's: a picked theme leaves only its own in play.
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][media]')) {
		if (!media.has(meta)) media.set(meta, meta.media);
		const query = media.get(meta)!;
		const scheme = /prefers-color-scheme:\s*(light|dark)/.exec(query)?.[1];
		meta.media = !picked || !scheme ? query : scheme === picked ? 'all' : 'not all';
	}
}
