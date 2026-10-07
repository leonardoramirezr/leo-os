<script lang="ts">
	// A model on Groq, picked from the ones the key can use: the chat model, or the one that writes
	// down what is dictated. A row for a group.
	import { chatModels, transcriptionModels } from '$lib/groq';
	import { model, models, transcriptionModel } from '$lib/settings.svelte';

	let { kind = 'chat' }: { kind?: 'chat' | 'transcription' } = $props();

	const picked = $derived(kind === 'chat' ? model : transcriptionModel);
	const options = $derived(
		kind === 'chat'
			? chatModels(models.value, model.value)
			: transcriptionModels(models.value, transcriptionModel.value)
	);
</script>

<label class="field inline">
	<span>{kind === 'chat' ? 'Modelo' : 'Voz a texto'}</span>
	<select bind:value={picked.value}>
		{#each options as option (option)}
			<option value={option}>{option}</option>
		{/each}
	</select>
</label>
