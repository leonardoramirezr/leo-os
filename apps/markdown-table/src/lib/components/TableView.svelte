<script lang="ts">
	import { HomeButton } from '@leo-os/shared';
	import { History } from '$lib/history.svelte';
	import type { TableData } from '$lib/markdown';
	import { tables, titleOf, type Table } from '$lib/tables.svelte';
	import GridEditor from './GridEditor.svelte';
	import Icon, { type IconName } from './Icon.svelte';
	import ImagePane from './ImagePane.svelte';
	import MarkdownPane from './MarkdownPane.svelte';
	import TableSheet from './TableSheet.svelte';

	let { table }: { table: Table } = $props();

	type Tab = 'grid' | 'markdown' | 'image';

	const TABS: { id: Tab; label: string; icon: IconName }[] = [
		{ id: 'grid', label: 'Tabla', icon: 'table' },
		{ id: 'markdown', label: 'Markdown', icon: 'markdown' },
		{ id: 'image', label: 'Imagen', icon: 'image' }
	];

	let tab = $state<Tab>('grid');
	let options = $state(false);

	/** What undo and redo walk: this table's changes since it was opened. */
	const steps = new History();

	const data = $derived<TableData>({ cells: table.cells, align: table.align });

	function snapshot(): TableData {
		return $state.snapshot({ cells: table.cells, align: table.align });
	}

	function change(next: TableData, key = '') {
		steps.record(snapshot, key);
		tables.change(table.id, next);
	}

	function undo() {
		const before = steps.undo(snapshot());
		if (before) tables.change(table.id, before);
	}

	function redo() {
		const after = steps.redo(snapshot());
		if (after) tables.change(table.id, after);
	}

	/**
	 * ⌘Z and ⇧⌘Z are this table's undo and redo. A cell's own would undo what Svelte last wrote into
	 * it, not what was typed; the Markdown box and the sheets keep theirs.
	 */
	function onkeydown(event: KeyboardEvent) {
		if (event.key.toLowerCase() !== 'z' || !(event.metaKey || event.ctrlKey) || event.altKey) return;
		const target = event.target as HTMLElement | null;
		if (target?.closest('textarea, dialog')) return;

		event.preventDefault();
		if (event.shiftKey) redo();
		else undo();
	}
</script>

<svelte:window {onkeydown} />

<div class="screen">
	<header>
		<div class="top">
			<div class="side">
				<button class="icon-button" type="button" onclick={() => history.back()} aria-label="Tablas" title="Tablas">
					<Icon name="back" size={26} />
				</button>
			</div>

			<h1>{titleOf(table)}</h1>

			<div class="side end">
				{#if tab !== 'image'}
					<button class="icon-button" type="button" onclick={undo} disabled={!steps.canUndo} aria-label="Deshacer" title="Deshacer">
						<Icon name="undo" />
					</button>
					<button class="icon-button" type="button" onclick={redo} disabled={!steps.canRedo} aria-label="Rehacer" title="Rehacer">
						<Icon name="redo" />
					</button>
				{/if}
				<button
					class="icon-button"
					type="button"
					onclick={() => (options = true)}
					aria-label="Opciones de la tabla"
					title="Opciones de la tabla"
					aria-haspopup="dialog"
				>
					<Icon name="more" />
				</button>
				<HomeButton />
			</div>
		</div>

		<div class="tabs">
			<div class="segmented" role="tablist" aria-label="Vista">
				{#each TABS as option (option.id)}
					<button type="button" role="tab" aria-selected={tab === option.id} onclick={() => (tab = option.id)}>
						<Icon name={option.icon} size={16} />
						{option.label}
					</button>
				{/each}
			</div>
		</div>
	</header>

	{#if tab === 'grid'}
		<GridEditor table={data} onchange={change} />
	{:else if tab === 'markdown'}
		<MarkdownPane table={data} onchange={change} />
	{:else}
		<ImagePane {table} />
	{/if}
</div>

<TableSheet bind:open={options} {table} />

<style>
	.screen {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 2;
		flex: none;
		padding-top: env(safe-area-inset-top);
		background: var(--bg);
	}

	.top {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: 6px max(10px, env(safe-area-inset-right)) 4px max(10px, env(safe-area-inset-left));
	}

	/* Both sides grow alike, so the title stays centred until it is too long for that. */
	.side {
		display: flex;
		flex: 1 1 0;
		align-items: center;
		gap: 2px;
		min-width: max-content;
	}

	.side.end {
		justify-content: flex-end;
	}

	h1 {
		flex: 0 1 auto;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		font-size: 17px;
		font-weight: 600;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tabs {
		width: 100%;
		max-width: 560px;
		margin: 0 auto;
		padding: 4px 16px 12px;
	}
</style>
