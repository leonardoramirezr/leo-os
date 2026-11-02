<script lang="ts">
	import { untrack } from 'svelte';
	import { replaceState } from '$app/navigation';
	import { tables, titleOf, type Table } from '$lib/tables.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable(), table }: { open: boolean; table: Table } = $props();

	let title = $state('');

	// Every time the sheet opens it starts from the name the table has.
	$effect(() => {
		if (open) untrack(() => (title = table.title));
	});

	function save(event: SubmitEvent) {
		event.preventDefault();
		open = false;
		if (title.trim() !== table.title) tables.rename(table.id, title);
	}

	function duplicate() {
		open = false;
		const id = tables.duplicate(table.id);
		// In place of this one: «back» still leads to the list.
		if (id) replaceState('', { table: id });
	}

	function remove() {
		if (!confirm(`¿Eliminar «${titleOf(table)}»?`)) return;
		open = false;
		tables.remove(table.id);
		// Its screen goes with it: back to the list of tables.
		history.back();
	}
</script>

<Sheet bind:open title="Tabla">
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}

	<form onsubmit={save}>
		<div class="group">
			<label class="field">
				<span>Título</span>
				<input
					bind:value={title}
					placeholder={titleOf({ ...table, title: '' })}
					autocapitalize="sentences"
					autocomplete="off"
					enterkeyhint="done"
				/>
			</label>
		</div>
		<p class="hint">Sin título, la tabla lleva el nombre de su encabezado. El estilo Ventana lo muestra en su barra.</p>

		<button class="primary" type="submit">Guardar</button>
	</form>

	<ul class="menu">
		<li>
			<button type="button" onclick={duplicate}>
				<Icon name="copy" />
				Duplicar tabla
			</button>
		</li>
		<li>
			<button class="danger" type="button" onclick={remove}>
				<Icon name="trash" />
				Eliminar tabla
			</button>
		</li>
	</ul>
</Sheet>

<style>
	.primary {
		margin-top: 16px;
	}

	.menu {
		margin-top: 24px;
	}
</style>
