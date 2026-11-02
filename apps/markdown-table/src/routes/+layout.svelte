<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { tables } from '$lib/tables.svelte';

	let { children } = $props();

	// Leaving the app, what was typed goes out at once rather than after the pause: iOS may stop the
	// page in the background. Coming back, another device may have changed the tables meanwhile.
	$effect(() => {
		const onvisibility = () => {
			if (document.visibilityState === 'visible') tables.refresh();
			else tables.flush();
		};
		const onleave = () => tables.flush();
		document.addEventListener('visibilitychange', onvisibility);
		window.addEventListener('pagehide', onleave);
		return () => {
			document.removeEventListener('visibilitychange', onvisibility);
			window.removeEventListener('pagehide', onleave);
		};
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account load={(userId) => tables.load(userId)}>
	{@render children()}
</Account>
