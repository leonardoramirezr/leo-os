<script lang="ts">
	import type { TableData } from '$lib/markdown';

	// A glance at a table — what a paste turned into — rather than all of it.
	let { table, rows = 5, columns = 6 }: { table: TableData; rows?: number; columns?: number } = $props();

	const shown = $derived(table.cells.slice(0, rows + 1).map((row) => row.slice(0, columns)));
	const more = $derived(table.cells.length - 1 > rows);
	const wider = $derived(table.align.length > columns);
</script>

<div class="mini">
	<table>
		<thead>
			<tr>
				{#each shown[0] as cell, column (column)}
					<th style:text-align={table.align[column] || 'left'}>{cell}</th>
				{/each}
				{#if wider}<th class="more">…</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each shown.slice(1) as row, index (index)}
				<tr>
					{#each row as cell, column (column)}
						<td style:text-align={table.align[column] || 'left'}>{cell}</td>
					{/each}
					{#if wider}<td class="more">…</td>{/if}
				</tr>
			{/each}
			{#if more}
				<tr>
					<td class="more" colspan={shown[0].length + (wider ? 1 : 0)}>…</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

<style>
	.mini {
		overflow-x: auto;
		border: 1px solid var(--grid);
		border-radius: 12px;
		background: var(--group);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;
		line-height: 1.35;
	}

	th,
	td {
		max-width: 160px;
		padding: 6px 10px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	th {
		background: var(--header-cell);
		font-weight: 600;
	}

	tr + tr td,
	tbody tr:first-child td {
		border-top: 1px solid var(--grid);
	}

	th + th,
	td + td {
		border-left: 1px solid var(--grid);
	}

	.more {
		color: var(--faint);
		text-align: center;
	}
</style>
