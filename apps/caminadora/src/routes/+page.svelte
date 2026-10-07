<script lang="ts">
	import { page } from '$app/state';
	import ProgramsView from '$lib/components/ProgramsView.svelte';
	import RunView from '$lib/components/RunView.svelte';
	import { runner } from '$lib/runner.svelte';

	// The screen showing lives in the history entry (SvelteKit's shallow routing), so the back button
	// and the back gesture walk back through the screens. Going back leaves the program running, and
	// the list says so; a reload lands on the list too.
</script>

{#if runner.run && page.state.run}
	<RunView run={runner.run} />
{:else}
	<ProgramsView />
{/if}
