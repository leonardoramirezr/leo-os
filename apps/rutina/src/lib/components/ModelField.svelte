<script lang="ts">
	// The chat model on Groq, picked from the ones the key can use: a row for a group.
	import { chatModels } from '$lib/groq';
	import { model, models } from '$lib/settings.svelte';
</script>

<label class="field inline">
	<span>Modelo</span>
	<select bind:value={model.value}>
		{#each chatModels(models.value, model.value) as option (option)}
			<option value={option}>{option}</option>
		{/each}
	</select>
</label>
