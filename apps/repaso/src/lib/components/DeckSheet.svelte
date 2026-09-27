<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { collection, type Deck } from '$lib/collection.svelte';
	import { plural } from '$lib/format';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		/** A deck already there: the sheet renames or deletes it instead of creating one. */
		deck?: Deck;
		/** Receives the deck just created. */
		oncreate?: (deck: Deck) => void;
	}

	let { open = $bindable(), deck, oncreate }: Props = $props();

	let name = $state('');
	let field = $state<HTMLInputElement>();

	// Every time the sheet opens it starts blank, or from the deck being renamed.
	$effect(() => {
		if (!open) return;

		untrack(() => (name = deck?.name ?? ''));
		tick().then(() => field?.focus());
	});

	function save(event: SubmitEvent) {
		event.preventDefault();
		const chosen = name.trim();
		if (!chosen) return;

		open = false;
		if (deck) collection.renameDeck(deck.id, chosen);
		else oncreate?.(collection.addDeck(chosen));
	}

	function remove() {
		if (!deck) return;

		const total = collection.countsOf(deck.id).total;
		const question = total
			? `¿Eliminar «${deck.name}» y sus ${plural(total, 'tarjeta', 'tarjetas')}? No se puede deshacer.`
			: `¿Eliminar «${deck.name}»?`;
		if (!confirm(question)) return;

		open = false;
		collection.removeDeck(deck.id);
		// Its screen goes with it: back to the list of decks.
		history.back();
	}
</script>

<Sheet bind:open title={deck ? 'Editar mazo' : 'Nuevo mazo'}>
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}

	<form onsubmit={save}>
		<div class="group">
			<label class="field">
				<span>Nombre</span>
				<input
					bind:this={field}
					bind:value={name}
					placeholder="Inglés, Anatomía, Historia…"
					autocomplete="off"
					enterkeyhint="done"
				/>
			</label>
		</div>

		<button class="primary" type="submit" disabled={!name.trim()}>
			{deck ? 'Guardar' : 'Crear mazo'}
		</button>
	</form>

	{#if deck}
		<button class="destructive" type="button" onclick={remove}>Eliminar mazo</button>
	{/if}
</Sheet>

<style>
	.primary {
		margin-top: 16px;
	}
</style>
