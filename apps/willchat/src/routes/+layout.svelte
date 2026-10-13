<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { lang } from '$lib/i18n';
	import { miniApps } from '$lib/miniapps.svelte';

	let { children } = $props();

	document.documentElement.lang = lang;

	// The mini apps may have changed on another device while this one sat in the background.
	$effect(() => {
		const refresh = () => {
			if (document.visibilityState === 'visible') miniApps.refresh();
		};
		document.addEventListener('visibilitychange', refresh);
		return () => document.removeEventListener('visibilitychange', refresh);
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account {lang} load={(userId) => miniApps.load(userId)}>
	{@render children()}
</Account>
