<script lang="ts">
	import { page } from '$app/state';
	import TableView from '$lib/components/TableView.svelte';
	import TablesView from '$lib/components/TablesView.svelte';
	import { tables } from '$lib/tables.svelte';

	// The screen showing lives in the history entry (SvelteKit's shallow routing), so the back button
	// and the back gesture walk back through the screens. A reload lands on the list of tables.
	const table = $derived(tables.find(page.state.table));
</script>

{#if table}
	<!-- Keyed: another table is another editor, its undo history and all. -->
	{#key table.id}
		<TableView {table} />
	{/key}
{:else}
	<TablesView />
{/if}
