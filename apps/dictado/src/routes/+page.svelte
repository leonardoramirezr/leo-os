<script lang="ts">
	import { page } from '$app/state';
	import ChangesView from '$lib/components/ChangesView.svelte';
	import DictationView from '$lib/components/DictationView.svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import { apiKey } from '$lib/settings.svelte';

	// The changes are a screen of their own in the history entry (SvelteKit's shallow routing), so the
	// back button and the back gesture return to the text. A reload lands on the text.
</script>

{#if !apiKey.value}
	<Onboarding />
{:else if page.state.changes}
	<ChangesView />
{:else}
	<DictationView />
{/if}
