<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { templates } from '$lib/templates.svelte';

	let { children } = $props();

	// The templates may have changed on another device while this one sat in the background.
	$effect(() => {
		const refresh = () => {
			if (document.visibilityState === 'visible') templates.refresh();
		};
		document.addEventListener('visibilitychange', refresh);
		return () => document.removeEventListener('visibilitychange', refresh);
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account load={(userId) => templates.load(userId)}>
	{@render children()}
</Account>
