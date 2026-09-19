<script lang="ts">
	import { allBanks, bankGroups } from '$lib/banks';

	interface Props {
		label: string;
		value: string;
	}

	let { label, value = $bindable() }: Props = $props();

	/** A stored bank that has since left the list is still a valid option. */
	const unlisted = $derived(value && !allBanks.includes(value) ? value : '');
</script>

<label class="row">
	<span class="label">{label}</span>
	<select bind:value>
		<option value="">Sin especificar</option>
		{#if unlisted}
			<option value={unlisted}>{unlisted}</option>
		{/if}
		{#each bankGroups as group (group.label)}
			<optgroup label={group.label}>
				{#each group.banks as bank (bank)}
					<option value={bank}>{bank}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
</label>

<style>
	select {
		color: var(--link);
	}

	/* The dropdown reads better left-aligned than the row's value does. */
	option {
		text-align: left;
	}
</style>
