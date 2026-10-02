<script lang="ts">
	import { page } from '$app/state';
	import ChangesView from '$lib/components/ChangesView.svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import PromptsView from '$lib/components/PromptsView.svelte';
	import PromptView from '$lib/components/PromptView.svelte';
	import { prompts } from '$lib/prompts.svelte';
	import { apiKey } from '$lib/settings.svelte';

	// The screen showing lives in the history entry (SvelteKit's shallow routing), so the back button
	// and the back gesture walk back through the screens. A reload lands on the list of prompts.
	const prompt = $derived(prompts.find(page.state.prompt));
</script>

{#if !apiKey.value}
	<Onboarding />
{:else if prompt && page.state.changes}
	<ChangesView />
{:else if prompt}
	<PromptView {prompt} />
{:else}
	<PromptsView />
{/if}
