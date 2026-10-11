<script lang="ts">
	import { page } from '$app/state';
	import FillView from '$lib/components/FillView.svelte';
	import TemplatesView from '$lib/components/TemplatesView.svelte';
	import { templates } from '$lib/templates.svelte';

	// The screen showing lives in the history entry (SvelteKit's shallow routing), so the back button
	// and the back gesture walk back through the screens. A reload lands on the list of templates.
	const template = $derived(templates.find(page.state.template));
</script>

{#if template}
	<FillView {template} />
{:else}
	<TemplatesView />
{/if}
