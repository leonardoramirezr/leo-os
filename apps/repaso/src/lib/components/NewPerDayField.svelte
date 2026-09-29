<script lang="ts">
	/** Anki's usual choices. A value saved some other way still shows, where it falls among them. */
	const CHOICES = [0, 5, 10, 15, 20, 30, 50, 100];

	let { value = $bindable() }: { value: number } = $props();

	const options = $derived(
		CHOICES.includes(value) ? CHOICES : [...CHOICES, value].toSorted((a, b) => a - b)
	);
</script>

<label class="field inline">
	<span>Nuevas al día</span>
	<select bind:value>
		{#each options as option (option)}
			<option value={option}>{option || 'Sin límite'}</option>
		{/each}
	</select>
</label>
