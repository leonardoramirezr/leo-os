<script lang="ts">
	import DictationView from '$lib/components/DictationView.svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import { apiKey } from '$lib/settings.svelte';
</script>

{#if apiKey.value}
	<DictationView />
{:else}
	<Onboarding />
{/if}
