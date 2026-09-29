import { local, setting } from '@leo-os/shared';

/** The home screen's own settings, opened from the Ajustes icon defined in `apps.ts`. */
export const ui = $state({
	settingsOpen: false,
	/** A colour being tried for the status bar, shown there before it is kept; '' when none is. */
	statusBarTrial: ''
});

/**
 * The wallpaper as a data URL, or '' for the built-in gradient. A photo is far too large for a
 * row read on every open, so it stays in this browser — under a key that carries the account, so
 * each one gets its own.
 */
export const wallpaper = local('home:wallpaper', '');

/**
 * The colour of the band under the status bar, at the height of the camera, as `#rrggbb`; '' for
 * app.html's. Added to the home screen, the site starts below that band and iOS fills it in.
 */
export const statusBar = setting('home:status-bar-color', '');
