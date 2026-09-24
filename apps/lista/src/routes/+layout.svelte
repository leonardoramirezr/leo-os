<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { list } from '$lib/list.svelte';

	let { children } = $props();

	// The list may have changed on another device while this one sat in the background.
	$effect(() => {
		const refresh = () => {
			if (document.visibilityState === 'visible') list.refresh();
		};
		document.addEventListener('visibilitychange', refresh);
		return () => document.removeEventListener('visibilitychange', refresh);
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account load={(userId) => list.load(userId)}>
	{@render children()}
</Account>
