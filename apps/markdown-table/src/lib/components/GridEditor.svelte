<script lang="ts">
	import { tick } from 'svelte';
	import * as edit from '$lib/edit';
	import type { Align, TableData } from '$lib/markdown';
	import Icon, { type IconName } from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		table: TableData;
		/** A change to apply; `key` names what it changed, so that typing in one cell undoes as one. */
		onchange: (next: TableData, key?: string) => void;
	}

	let { table, onchange }: Props = $props();

	let grid = $state<HTMLElement>();

	/** The column, and the row, whose sheet is open. */
	let column = $state(0);
	let row = $state(1);
	let columnOpen = $state(false);
	let rowOpen = $state(false);

	const columns = $derived(table.align.length);
	const rows = $derived(table.cells.length);

	const ALIGNS: { value: Align; icon: IconName; label: string }[] = [
		{ value: 'left', icon: 'align-left', label: 'Izquierda' },
		{ value: 'center', icon: 'align-center', label: 'Centro' },
		{ value: 'right', icon: 'align-right', label: 'Derecha' }
	];

	/** A, B… Z, AA: how a spreadsheet names its columns. */
	function letter(index: number): string {
		let name = '';
		for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
		return name;
	}

	function cellOf(r: number, c: number) {
		return grid?.querySelector<HTMLInputElement>(`input[data-cell="${r}:${c}"]`);
	}

	async function focusCell(r: number, c: number) {
		await tick();
		const input = cellOf(r, c);
		input?.focus();
		input?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	function oninput(r: number, c: number, event: Event & { currentTarget: HTMLInputElement }) {
		onchange(edit.setCell(table, r, c, event.currentTarget.value), `cell:${r}:${c}`);
	}

	/** Down a row with Enter, as a spreadsheet does; past the last one, Enter adds another. */
	function onkeydown(r: number, c: number, event: KeyboardEvent) {
		if (event.isComposing) return;

		const down = (event.key === 'Enter' && !event.shiftKey) || event.key === 'ArrowDown';
		const up = (event.key === 'Enter' && event.shiftKey) || event.key === 'ArrowUp';
		if (down) {
			event.preventDefault();
			if (r + 1 < rows) focusCell(r + 1, c);
			else if (event.key === 'Enter') {
				onchange(edit.insertRow(table, rows));
				focusCell(r + 1, c);
			}
		} else if (up) {
			event.preventDefault();
			if (r > 0) focusCell(r - 1, c);
		}
	}

	function openColumn(c: number) {
		column = c;
		columnOpen = true;
	}

	function openRow(r: number) {
		row = r;
		rowOpen = true;
	}

	/** An action of a sheet that is done once: the sheet closes behind it. */
	function apply(next: TableData, focus?: [number, number]) {
		columnOpen = rowOpen = false;
		onchange(next);
		if (focus) focusCell(...focus);
	}

	// Aligning and moving leave the sheet open, on the same column or row, to do it again.
	function align(value: Align) {
		const current = table.align[column];
		// «Izquierda» is how a column with no alignment looks already: tapping it leaves `---` as it is.
		if (value === 'left' && (current === '' || current === 'left')) return;
		onchange(edit.setAlign(table, column, value));
	}

	function moveColumn(by: -1 | 1) {
		onchange(edit.moveColumn(table, column, by));
		column += by;
	}

	function moveRow(by: -1 | 1) {
		onchange(edit.moveRow(table, row, by));
		row += by;
	}

	function removeColumn() {
		const empty = table.cells.every((cells) => !cells[column].trim());
		if (!empty && !confirm(`¿Eliminar la columna ${letter(column)} y lo que tiene?`)) return;
		apply(edit.removeColumn(table, column));
	}

	function removeRow() {
		apply(edit.removeRow(table, row));
	}
</script>

<div class="editor">
	<div class="scroller" bind:this={grid}>
		<table>
			<thead>
				<tr>
					<th class="corner" aria-hidden="true"></th>
					{#each table.align as value, c (c)}
						<th class="handle">
							<button type="button" onclick={() => openColumn(c)} aria-haspopup="dialog" aria-label={`Columna ${letter(c)}`}>
								{letter(c)}
								{#if value === 'center' || value === 'right'}
									<Icon name={value === 'center' ? 'align-center' : 'align-right'} size={13} stroke={2.4} />
								{/if}
							</button>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each table.cells as cells, r (r)}
					<tr class:header={r === 0}>
						<th class="number" scope="row">
							{#if r === 0}
								<span title="Encabezado">Enc.</span>
							{:else}
								<button type="button" onclick={() => openRow(r)} aria-haspopup="dialog" aria-label={`Fila ${r}`}>
									{r}
								</button>
							{/if}
						</th>
						{#each cells as cell, c (c)}
							{@const placeholder = r === 0 ? `Columna ${letter(c)}` : ''}
							<td style:text-align={table.align[c] || 'left'}>
								<!-- The cell is as wide as its text, which this copy of it sizes; the input sits on top. -->
								<span class="sizer" aria-hidden="true">{cell || placeholder || ' '}</span>
								<input
									value={cell}
									{placeholder}
									data-cell={`${r}:${c}`}
									aria-label={r === 0 ? `Encabezado de la columna ${letter(c)}` : `Fila ${r}, columna ${letter(c)}`}
									autocomplete="off"
									autocapitalize="sentences"
									enterkeyhint="next"
									oninput={(event) => oninput(r, c, event)}
									onkeydown={(event) => onkeydown(r, c, event)}
								/>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="add">
		<button type="button" onclick={() => apply(edit.insertRow(table, rows), [rows, 0])}>
			<Icon name="row-below" size={18} />
			Fila
		</button>
		<button type="button" onclick={() => apply(edit.insertColumn(table, columns), [0, columns])}>
			<Icon name="column-right" size={18} />
			Columna
		</button>
	</div>

	<p class="hint">
		Toca una letra o un número para alinear, ordenar, mover o eliminar. Dentro de una celda vale el Markdown:
		<code>**negrita**</code>, <code>*cursiva*</code>, <code>`código`</code> y <code>&lt;br&gt;</code> para otra línea.
	</p>
</div>

<Sheet bind:open={columnOpen} title={`Columna ${letter(column)}`}>
	{#snippet trailing()}
		<button class="text-button strong" type="button" onclick={() => (columnOpen = false)}>Listo</button>
	{/snippet}

	<div class="segmented" role="group" aria-label="Alineación">
		{#each ALIGNS as option (option.value)}
			<button
				type="button"
				aria-pressed={(table.align[column] || 'left') === option.value}
				onclick={() => align(option.value)}
			>
				<Icon name={option.icon} size={16} />
				{option.label}
			</button>
		{/each}
	</div>

	<ul class="menu">
		<li>
			<button type="button" onclick={() => apply(edit.sortBy(table, column, 1))} disabled={rows < 3}>
				<Icon name="sort-up" />
				Ordenar de la A a la Z
			</button>
		</li>
		<li>
			<button type="button" onclick={() => apply(edit.sortBy(table, column, -1))} disabled={rows < 3}>
				<Icon name="sort-down" />
				Ordenar de la Z a la A
			</button>
		</li>
	</ul>

	<ul class="menu">
		<li>
			<button type="button" onclick={() => apply(edit.insertColumn(table, column), [0, column])}>
				<Icon name="column-left" />
				Insertar columna a la izquierda
			</button>
		</li>
		<li>
			<button type="button" onclick={() => apply(edit.insertColumn(table, column + 1), [0, column + 1])}>
				<Icon name="column-right" />
				Insertar columna a la derecha
			</button>
		</li>
		<li>
			<button type="button" onclick={() => apply(edit.duplicateColumn(table, column))}>
				<Icon name="copy" />
				Duplicar columna
			</button>
		</li>
		<li>
			<button type="button" onclick={() => moveColumn(-1)} disabled={column === 0}>
				<Icon name="arrow-left" />
				Mover a la izquierda
			</button>
		</li>
		<li>
			<button type="button" onclick={() => moveColumn(1)} disabled={column >= columns - 1}>
				<Icon name="arrow-right" />
				Mover a la derecha
			</button>
		</li>
	</ul>

	<ul class="menu">
		<li>
			<button class="danger" type="button" onclick={removeColumn} disabled={columns <= 1}>
				<Icon name="trash" />
				Eliminar columna
			</button>
		</li>
	</ul>
</Sheet>

<Sheet bind:open={rowOpen} title={`Fila ${row}`}>
	{#snippet trailing()}
		<button class="text-button strong" type="button" onclick={() => (rowOpen = false)}>Listo</button>
	{/snippet}

	<ul class="menu">
		<li>
			<button type="button" onclick={() => apply(edit.insertRow(table, row), [row, 0])}>
				<Icon name="row-above" />
				Insertar fila arriba
			</button>
		</li>
		<li>
			<button type="button" onclick={() => apply(edit.insertRow(table, row + 1), [row + 1, 0])}>
				<Icon name="row-below" />
				Insertar fila abajo
			</button>
		</li>
		<li>
			<button type="button" onclick={() => apply(edit.duplicateRow(table, row))}>
				<Icon name="copy" />
				Duplicar fila
			</button>
		</li>
		<li>
			<button type="button" onclick={() => moveRow(-1)} disabled={row <= 1}>
				<Icon name="arrow-up" />
				Mover arriba
			</button>
		</li>
		<li>
			<button type="button" onclick={() => moveRow(1)} disabled={row >= rows - 1}>
				<Icon name="arrow-down" />
				Mover abajo
			</button>
		</li>
		<li>
			<button type="button" onclick={() => apply(edit.promoteRow(table, row))}>
				<Icon name="arrow-up" />
				Usar como encabezado
			</button>
		</li>
	</ul>

	<ul class="menu">
		<li>
			<button class="danger" type="button" onclick={removeRow}>
				<Icon name="trash" />
				Eliminar fila
			</button>
		</li>
	</ul>
</Sheet>

<style>
	.editor {
		padding-bottom: calc(24px + env(safe-area-inset-bottom));
	}

	/* Wider than the screen, the table scrolls sideways on its own; the page only scrolls down. */
	.scroller {
		overflow-x: auto;
		padding: 4px max(16px, env(safe-area-inset-right)) 8px max(16px, env(safe-area-inset-left));
		overscroll-behavior-x: contain;
	}

	table {
		margin: 0 auto 0 0;
		border-collapse: separate;
		border-spacing: 0;
	}

	.corner,
	.number {
		position: sticky;
		left: 0;
		z-index: 1;
		width: 40px;
		min-width: 40px;
		padding: 0 6px 0 0;
		background: var(--bg);
		/* It sticks at the scroller's padding, not its edge: this covers the strip the cells scroll under. */
		box-shadow: -24px 0 0 var(--bg);
	}

	.handle {
		padding: 0 2px 6px;
		font-weight: 400;
	}

	.handle button,
	.number button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		width: 100%;
		border: 0;
		border-radius: 8px;
		background: var(--handle);
		color: var(--muted);
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.handle button {
		height: 26px;
	}

	.number button {
		height: 32px;
	}

	.number > span {
		display: block;
		color: var(--faint);
		font-size: 11px;
		font-weight: 600;
		text-align: center;
	}

	@media (hover: hover) {
		.handle button:hover,
		.number button:hover {
			background: var(--hover);
			color: var(--text);
		}
	}

	td {
		position: relative;
		padding: 0;
		border-right: 1px solid var(--grid);
		border-bottom: 1px solid var(--grid);
		background: var(--group);
	}

	tr > td:first-of-type {
		border-left: 1px solid var(--grid);
	}

	tr.header td {
		border-top: 1px solid var(--grid);
		background: var(--header-cell);
		font-weight: 600;
	}

	tr.header td:first-of-type {
		border-top-left-radius: 12px;
	}

	tr.header td:last-child {
		border-top-right-radius: 12px;
	}

	tbody tr:last-child td:first-of-type {
		border-bottom-left-radius: 12px;
	}

	tbody tr:last-child td:last-child {
		border-bottom-right-radius: 12px;
	}

	.sizer,
	input {
		padding: 10px 12px;
		font-size: 16px;
		line-height: 1.3;
	}

	.sizer {
		display: block;
		min-width: 4.5em;
		max-width: 18em;
		overflow: hidden;
		visibility: hidden;
		white-space: pre;
	}

	/* 16px at least: iOS zooms in on anything smaller when it is focused. */
	input {
		position: absolute;
		inset: 0;
		width: 100%;
		min-width: 0;
		margin: 0;
		border: 0;
		border-radius: inherit;
		outline: none;
		background: transparent;
		font-weight: inherit;
		text-align: inherit;
	}

	input::placeholder {
		color: var(--faint);
		font-weight: 400;
	}

	input:focus {
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	.add {
		display: flex;
		gap: 10px;
		padding: 6px max(16px, env(safe-area-inset-left)) 0 calc(max(16px, env(safe-area-inset-left)) + 40px);
	}

	.add button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border: 0;
		border-radius: 999px;
		background: var(--tint-bg);
		color: var(--tint);
		font-size: 15px;
		font-weight: 600;
	}

	.hint {
		max-width: 560px;
		margin: 16px max(16px, env(safe-area-inset-left)) 0;
	}

	code {
		font-family: var(--mono);
		font-size: 12px;
		color: var(--tint);
	}
</style>
