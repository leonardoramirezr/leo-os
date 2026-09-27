<script lang="ts">
	import ListView from '$lib/components/ListView.svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import { apiKey } from '$lib/settings.svelte';
</script>

{#if apiKey.value}
	<ListView />
{:else}
	<Onboarding />
{/if}
