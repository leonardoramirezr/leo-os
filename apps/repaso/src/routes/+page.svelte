<script lang="ts">
	import { page } from '$app/state';
	import DeckView from '$lib/components/DeckView.svelte';
	import DecksView from '$lib/components/DecksView.svelte';
	import StudyView from '$lib/components/StudyView.svelte';
	import { collection } from '$lib/collection.svelte';

	// The screen showing lives in the history entry (SvelteKit's shallow routing), so the back button
	// and the back gesture walk back through the screens. A reload lands on the list of decks.
	const deck = $derived(collection.decks.find((candidate) => candidate.id === page.state.deck));
</script>

{#if deck && page.state.study}
	<StudyView {deck} />
{:else if deck}
	<DeckView {deck} />
{:else}
	<DecksView />
{/if}
