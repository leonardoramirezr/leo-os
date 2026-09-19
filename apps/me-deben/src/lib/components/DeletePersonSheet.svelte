<script lang="ts">
	import { ledger, type Person } from '$lib/ledger.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		person: Person;
		/** Se avisa al borrar para que la hoja de la persona se cierre con ella. */
		ondelete: () => void;
	}

	let { open = $bindable(), person, ondelete }: Props = $props();

	let typed = $state('');

	const movements = $derived(ledger.movementsOf(person.id).length);

	/** Escribir el nombre es la confirmación; no se exige acertar mayúsculas ni espacios. */
	const confirmed = $derived(
		typed.trim().toLocaleLowerCase('es') === person.name.toLocaleLowerCase('es')
	);

	// Cada vez que se abre la hoja hay que volver a escribir el nombre.
	$effect(() => {
		if (open) typed = '';
	});

	function remove() {
		if (!confirmed) return;

		ledger.removePerson(person.id);
		open = false;
		ondelete();
	}
</script>

<Sheet bind:open title="Eliminar persona">
	{#snippet leading()}
		<button class="plain" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}

	<p class="warn">
		Se borra a <strong>{person.name}</strong>
		{#if movements === 1}
			y el movimiento que tiene registrado.
		{:else if movements > 1}
			y sus {movements} movimientos.
		{:else}
			de la lista.
		{/if}
		Esto no se puede deshacer.
	</p>

	<p class="ask">
		Escribe <strong>{person.name}</strong> para confirmar.
	</p>

	<div class="field">
		<input
			type="text"
			bind:value={typed}
			placeholder={person.name}
			autocomplete="off"
			autocorrect="off"
			autocapitalize="words"
			spellcheck="false"
			enterkeyhint="done"
			onkeydown={(event) => {
				if (event.key === 'Enter') remove();
			}}
		/>
	</div>

	<div class="save">
		<button class="primary danger" type="button" disabled={!confirmed} onclick={remove}>
			Eliminar persona
		</button>
	</div>
</Sheet>

<style>
	.plain {
		padding: 4px 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 17px;
	}

	.warn {
		margin: 0 4px 16px;
		color: var(--danger);
	}

	.ask {
		margin: 0 4px 8px;
		color: var(--muted);
		font-size: 14px;
	}

	.warn strong {
		font-weight: 600;
	}

	.ask strong {
		color: var(--text);
		font-weight: 600;
	}

	.field {
		border-radius: 12px;
		background: var(--group);
	}

	input {
		width: 100%;
		padding: 12px 16px;
		border: 0;
		border-radius: 12px;
		background: none;
	}

	input:focus {
		outline: none;
	}

	.save {
		margin-top: 24px;
	}

	.danger {
		background: var(--danger);
	}
</style>
