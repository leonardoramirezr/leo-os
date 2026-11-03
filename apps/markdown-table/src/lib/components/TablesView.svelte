<script lang="ts">
	import icon from '../../../icon.svg';
	import { pushState } from '$app/navigation';
	import { HomeButton } from '@leo-os/shared';
	import { tables, titleOf, type Table } from '$lib/tables.svelte';
	import Icon from './Icon.svelte';
	import NewTableSheet from './NewTableSheet.svelte';

	let creating = $state(false);
	let mode = $state<'paste' | 'blank'>('paste');

	function open(id: string) {
		pushState('', { table: id });
	}

	function create(how: 'paste' | 'blank') {
		mode = how;
		creating = true;
	}

	function size(table: Table): string {
		const columns = table.align.length;
		const rows = table.cells.length - 1;
		return `${columns === 1 ? '1 columna' : `${columns} columnas`} · ${rows === 1 ? '1 fila' : `${rows} filas`}`;
	}

	/** What the table says under its name: its header, unless the header is already its name. */
	function header(table: Table): string {
		if (!table.title.trim()) return table.cells[1]?.filter((cell) => cell.trim()).join(' · ') ?? '';
		return table.cells[0].filter((cell) => cell.trim()).join(' · ');
	}
</script>

<div class="screen">
	<header class="bar">
		<HomeButton />
	</header>

	<h1>Markdown Table</h1>

	{#if tables.list.length}
		<p class="caption">Pega una tabla o crea una, edítala y expórtala como imagen.</p>

		<ul class="tables">
			{#each tables.sorted as table (table.id)}
				<li>
					<button class="table" onclick={() => open(table.id)}>
						<span class="glyph"><Icon name="table" size={22} /></span>
						<span class="text">
							<span class="title">{titleOf(table)}</span>
							{#if header(table)}<span class="header">{header(table)}</span>{/if}
							<span class="size">{size(table)}</span>
						</span>
						<span class="chevron"><Icon name="forward" size={18} /></span>
					</button>
				</li>
			{/each}
			<li>
				<button class="table add" onclick={() => create('paste')} aria-haspopup="dialog">
					<Icon name="plus" />
					Nueva tabla
				</button>
			</li>
		</ul>
	{:else}
		<div class="empty">
			<img class="logo" src={icon} alt="" width="84" height="84" />
			<p class="empty-title">Tu primera tabla</p>
			<p class="empty-text">
				Pega una tabla en Markdown, o celdas copiadas de una hoja de cálculo, o empieza una en blanco.
				Después la editas aquí mismo y la exportas como Markdown o como imagen.
			</p>
			<div class="empty-actions">
				<button class="primary" onclick={() => create('paste')} aria-haspopup="dialog">
					<Icon name="paste" />
					Pegar una tabla
				</button>
				<button class="secondary" onclick={() => create('blank')} aria-haspopup="dialog">
					<Icon name="table" />
					Empezar en blanco
				</button>
			</div>
		</div>
	{/if}
</div>

<NewTableSheet bind:open={creating} bind:mode oncreate={open} />

<style>
	.screen {
		max-width: 560px;
		margin: 0 auto;
		padding: 0 16px calc(32px + env(safe-area-inset-bottom));
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		margin: 0 -8px;
		padding-top: calc(env(safe-area-inset-top) + 6px);
	}

	h1 {
		margin: 2px 4px 0;
		font-size: 34px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.caption {
		margin: 2px 4px 20px;
		color: var(--muted);
		font-size: 15px;
	}

	.tables {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.table {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-height: 74px;
		padding: 14px 12px 14px 14px;
		border: 0;
		border-radius: 18px;
		background: var(--group);
		box-shadow: var(--shadow);
		text-align: left;
		transition: transform 0.12s;
	}

	.table:active {
		transform: scale(0.98);
	}

	.glyph {
		display: grid;
		flex: none;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 12px;
		background: var(--tint-bg);
		color: var(--tint);
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
	}

	.title,
	.header {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.title {
		font-size: 17px;
		font-weight: 600;
	}

	.header {
		color: var(--muted);
		font-size: 14px;
	}

	.size {
		margin-top: 2px;
		color: var(--tint);
		font-size: 13px;
		font-weight: 600;
	}

	.chevron {
		color: var(--faint);
	}

	.table.add {
		justify-content: center;
		gap: 8px;
		min-height: 56px;
		border: 1.5px dashed var(--border);
		background: transparent;
		box-shadow: none;
		color: var(--tint);
		font-size: 16px;
		font-weight: 600;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 12px;
		text-align: center;
	}

	.logo {
		border-radius: 22.5%;
		box-shadow: var(--shadow);
	}

	.empty-title {
		margin: 20px 0 8px;
		font-size: 20px;
		font-weight: 700;
	}

	.empty-text {
		max-width: 340px;
		margin: 0 0 24px;
		color: var(--muted);
		line-height: 1.5;
	}

	.empty-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		max-width: 280px;
	}

	.empty-actions button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.secondary {
		width: 100%;
		padding: 14px;
		border: 0;
		border-radius: 14px;
		background: var(--group);
		box-shadow: var(--shadow);
		color: var(--tint);
		font-size: 17px;
		font-weight: 600;
		transition: transform 0.1s;
	}

	.secondary:active {
		transform: scale(0.98);
	}
</style>
