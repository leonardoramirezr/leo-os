<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { collection, type Card } from '$lib/collection.svelte';
	import { plural } from '$lib/format';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		deckId: string;
		/** A card already in the deck: the sheet corrects it instead of adding a new one. */
		card?: Card;
	}

	let { open = $bindable(), deckId, card }: Props = $props();

	let front = $state('');
	let back = $state('');
	/** Cards added since the sheet opened: it stays open for the next one, as Anki's does. */
	let added = $state(0);
	let frontField = $state<HTMLTextAreaElement>();

	const complete = $derived(front.trim() !== '' && back.trim() !== '');

	// Every time the sheet opens it starts blank, or from the card being corrected.
	$effect(() => {
		if (!open) return;

		untrack(() => {
			front = card?.front ?? '';
			back = card?.back ?? '';
			added = 0;
			// Adding goes straight to typing; correcting waits for a field to be tapped.
			if (!card) tick().then(() => frontField?.focus());
		});
	});

	function save(event?: SubmitEvent) {
		event?.preventDefault();
		if (!complete) return;

		if (card) {
			collection.updateCard(card.id, { front, back });
			open = false;
			return;
		}

		collection.addCards(deckId, [{ front, back }]);
		added++;
		front = '';
		back = '';
		frontField?.focus();
	}

	function remove() {
		if (!card || !confirm('¿Eliminar esta tarjeta? No se puede deshacer.')) return;

		// Closed first: from the study screen, the card leaving is what brings on the next one.
		open = false;
		collection.removeCard(card.id);
	}

	// ⌘ or Ctrl + Enter saves from either field, as in Anki.
	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save();
	}
</script>

<Sheet bind:open title={card ? 'Editar tarjeta' : 'Nueva tarjeta'}>
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>
			{added ? 'Listo' : 'Cancelar'}
		</button>
	{/snippet}

	<form onsubmit={save}>
		<div class="group">
			<label class="field">
				<span>Frente</span>
				<textarea
					bind:this={frontField}
					bind:value={front}
					rows="3"
					placeholder="La pregunta"
					{onkeydown}
				></textarea>
			</label>
			<label class="field">
				<span>Reverso</span>
				<textarea bind:value={back} rows="3" placeholder="La respuesta" {onkeydown}></textarea>
			</label>
		</div>

		<button class="primary" type="submit" disabled={!complete}>
			{card ? 'Guardar' : 'Añadir tarjeta'}
		</button>

		{#if added}
			<p class="hint added" role="status">
				{plural(added, 'tarjeta añadida', 'tarjetas añadidas')}. Escribe la siguiente o toca «Listo».
			</p>
		{/if}
	</form>

	{#if card}
		<button class="destructive" type="button" onclick={remove}>Eliminar tarjeta</button>
	{/if}
</Sheet>

<style>
	.primary {
		margin-top: 16px;
	}

	.added {
		text-align: center;
	}
</style>
