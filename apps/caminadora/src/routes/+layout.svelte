<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { programs } from '$lib/programs.svelte';
	import { runner } from '$lib/runner.svelte';

	let { children } = $props();

	// The programs may have changed on another device while this one sat in the background.
	$effect(() => {
		const refresh = () => {
			if (document.visibilityState === 'visible') programs.refresh();
		};
		document.addEventListener('visibilitychange', refresh);
		return () => document.removeEventListener('visibilitychange', refresh);
	});

	async function load(userId: string) {
		// A program that was running when the app was closed goes on from where the treadmill is.
		runner.restore();
		await programs.load(userId);
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account {load}>
	{@render children()}
</Account>
