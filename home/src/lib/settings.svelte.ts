import { local } from '@leo-os/shared';

/** The home screen's own settings, opened from the Ajustes icon defined in `apps.ts`. */
export const ui = $state({ settingsOpen: false });

/**
 * The wallpaper as a data URL, or '' for the built-in gradient. A photo is far too large for a
 * row read on every open, so it stays in this browser — under a key that carries the account, so
 * each one gets its own.
 */
export const wallpaper = local('home:wallpaper', '');
