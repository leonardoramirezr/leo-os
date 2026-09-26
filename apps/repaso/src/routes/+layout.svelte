<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { collection } from '$lib/collection.svelte';

	let { children } = $props();

	// What is due follows the clock: a card learned ten minutes ago may be due now. Coming back to the
	// app, the cards may also have been studied on another device in the meantime.
	$effect(() => {
		const timer = setInterval(() => collection.tick(), 30_000);
		const onvisible = () => {
			if (document.visibilityState !== 'visible') return;
			collection.tick();
			collection.refresh();
		};
		document.addEventListener('visibilitychange', onvisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onvisible);
		};
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account load={(userId) => collection.load(userId)}>
	{@render children()}
</Account>
