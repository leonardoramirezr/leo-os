import { resolve } from '$app/paths';
import { session } from '@leo-os/shared';
import reloadIcon from './reload.svg';
import { ui } from './settings.svelte';
import settingsIcon from './settings.svg';
import signOutIcon from './sign-out.svg';

/**
 * Apps are discovered at build time. Every folder in `apps/<slug>/` must contain:
 *
 * - `app.json`: the manifest, e.g. `{ "name": "WillChat" }`.
 * - `icon.svg`: square, full-bleed artwork. The home screen applies the rounded mask.
 *
 * The app is published at `<base>/<slug>/`.
 */
interface AppManifest {
	name: string;
}

export type App = {
	slug: string;
	name: string;
	icon: string;
} & ({ href: string } | { action: () => void });

/** Built into the home screen: they run an action instead of opening a published app. */
const builtIns: App[] = [
	{
		slug: 'settings',
		name: 'Ajustes',
		icon: settingsIcon,
		// The home screen's own settings, e.g. the wallpaper.
		action: () => (ui.settingsOpen = true)
	},
	{
		slug: 'reload',
		name: 'Recargar',
		icon: reloadIcon,
		// Like Cmd+R, for when the site runs full screen without browser controls.
		// A reload keeps localStorage and IndexedDB.
		action: () => location.reload()
	},
	{
		slug: 'sign-out',
		name: 'Cerrar sesión',
		icon: signOutIcon,
		// An icon is easy to tap by accident, and signing back in means typing the password again.
		action: () => {
			if (!session.busy && confirm('¿Cerrar sesión?')) session.signOut();
		}
	}
];

const manifests = import.meta.glob<AppManifest>('../../../apps/*/app.json', {
	eager: true,
	import: 'default'
});

const icons = import.meta.glob<string>('../../../apps/*/icon.svg', {
	eager: true,
	query: '?url',
	import: 'default'
});

export const apps: App[] = [
	...Object.entries(manifests).map(([path, manifest]): App => {
		const slug = path.split('/').at(-2)!;
		return {
			slug,
			name: manifest.name,
			icon: icons[path.replace(/app\.json$/, 'icon.svg')],
			href: `${resolve('/')}${slug}/`
		};
	}),
	...builtIns
].sort((a, b) => a.name.localeCompare(b.name));
