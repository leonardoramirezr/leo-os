<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { ledger } from '$lib/ledger.svelte';

	let { children } = $props();

	// The app stays open from one day to the next: coming back to it recomputes what is overdue.
	$effect(() => {
		const refresh = () => ledger.refreshToday();
		document.addEventListener('visibilitychange', refresh);
		return () => document.removeEventListener('visibilitychange', refresh);
	});
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

{@render children()}
