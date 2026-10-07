<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { watch } from '$lib/watch.svelte';

	let { children } = $props();

	async function load() {
		// A stopwatch or a timer that was running when the app was closed goes on from where it is.
		watch.restore();
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account {load}>
	{@render children()}
</Account>
