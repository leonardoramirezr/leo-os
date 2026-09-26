<script lang="ts">
	import { pushState } from '$app/navigation';
	import { collection, type Card, type Deck } from '$lib/collection.svelte';
	import { formatWait } from '$lib/format';
	import { isDue } from '$lib/schedule';
	import CardSheet from './CardSheet.svelte';
	import DeckSheet from './DeckSheet.svelte';
	import GenerateSheet from './GenerateSheet.svelte';
	import Icon from './Icon.svelte';

	let { deck }: { deck: Deck } = $props();

	let editingDeck = $state(false);
	let adding = $state(false);
	let generating = $state(false);
	let selected = $state<Card>();
	let editingCard = $state(false);

	const counts = $derived(collection.countsOf(deck.id));
	const cards = $derived(collection.cardsOf(deck.id));
	const pending = $derived(counts.new + counts.due);
	/** With nothing to study, when there will be something again. */
	const next = $derived(pending ? 0 : collection.nextDue(deck.id));

	function study() {
		pushState('', { deck: deck.id, study: true });
	}

	function edit(card: Card) {
		selected = card;
		editingCard = true;
	}

	/** When the card comes up next, as the list shows it. */
	function when(card: Card): string {
		if (card.state === 'new') return 'Nueva';
		if (isDue(card, collection.now)) return 'Hoy';
		return formatWait(card.due - collection.now);
	}
</script>

<div class="screen">
	<header class="bar">
		<button class="back" onclick={() => history.back()}>
			<Icon name="back" size={24} />
			Mazos
		</button>
		<button class="text-button" onclick={() => (editingDeck = true)} aria-haspopup="dialog">Editar</button>
	</header>

	<h1>{deck.name}</h1>

	{#if counts.total}
		<div class="stats">
			<div class="stat">
				<span class="value new">{counts.new}</span>
				<span class="label">Nuevas</span>
			</div>
			<div class="stat">
				<span class="value due">{counts.due}</span>
				<span class="label">Por repasar</span>
			</div>
			<div class="stat">
				<span class="value">{counts.total}</span>
				<span class="label">En total</span>
			</div>
		</div>

		<button class="study" disabled={!pending} onclick={study}>
			{pending ? 'Estudiar' : 'Todo al día'}
		</button>
		{#if next}
			<p class="next">La próxima tarjeta vuelve en {formatWait(next - collection.now)}.</p>
		{/if}
	{/if}

	<div class="actions">
		<button class="action" onclick={() => (adding = true)} aria-haspopup="dialog">
			<Icon name="plus" />
			Añadir tarjeta
		</button>
		<button class="action" onclick={() => (generating = true)} aria-haspopup="dialog">
			<Icon name="sparkles" />
			Generar con IA
		</button>
	</div>

	{#if cards.length}
		<h2 class="section-title">Tarjetas</h2>
		<ul class="group">
			{#each cards as card (card.id)}
				<li>
					<button class="card" onclick={() => edit(card)}>
						<span class="text">
							<span class="front">{card.front}</span>
							<span class="back-text">{card.back}</span>
						</span>
						<span class="when" class:fresh={card.state === 'new'}>{when(card)}</span>
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="empty">
			<p class="empty-title">Este mazo está vacío</p>
			<p class="empty-text">
				Añade tarjetas a mano, o di de qué tema las quieres y deja que la IA las escriba.
			</p>
		</div>
	{/if}
</div>

<DeckSheet bind:open={editingDeck} {deck} />
<CardSheet bind:open={adding} deckId={deck.id} />
<CardSheet bind:open={editingCard} deckId={deck.id} card={selected} />
<GenerateSheet bind:open={generating} {deck} />

<style>
	.screen {
		max-width: 560px;
		margin: 0 auto;
		padding: 0 16px calc(32px + env(safe-area-inset-bottom));
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 46px;
		padding-top: calc(env(safe-area-inset-top) + 6px);
	}

	.back {
		display: flex;
		align-items: center;
		margin-left: -8px;
		padding: 4px 8px 4px 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 17px;
	}

	h1 {
		margin: 4px 4px 0;
		font-size: 32px;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin: 20px 0 14px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 14px 14px 12px;
		border-radius: 16px;
		background: var(--group);
		box-shadow: var(--shadow);
	}

	.value {
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	/* Anki's colours: blue for what is new, green for what comes back. */
	.value.new {
		color: var(--easy);
	}

	.value.due {
		color: var(--good);
	}

	.label {
		color: var(--muted);
		font-size: 13px;
	}

	.study {
		width: 100%;
		padding: 16px;
		border: 0;
		border-radius: 16px;
		background: var(--accent);
		box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 35%, transparent);
		color: #fff;
		font-size: 17px;
		font-weight: 600;
		transition: transform 0.1s;
	}

	.study:active:not(:disabled) {
		transform: scale(0.98);
	}

	.study:disabled {
		background: var(--group);
		box-shadow: var(--shadow);
		color: var(--muted);
	}

	.next {
		margin: 10px 4px 0;
		color: var(--muted);
		font-size: 14px;
		text-align: center;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-top: 14px;
	}

	.action {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 13px 8px;
		border: 0;
		border-radius: 14px;
		background: var(--group);
		box-shadow: var(--shadow);
		color: var(--tint);
		font-size: 15px;
		font-weight: 600;
		transition: transform 0.1s;
	}

	.action:active {
		transform: scale(0.97);
	}

	.group li + li {
		border-top: 1px solid var(--border);
	}

	.card {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		border: 0;
		background: none;
		text-align: left;
	}

	.card:active {
		background: var(--hover);
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 2px;
	}

	.front,
	.back-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.front {
		font-size: 16px;
	}

	.back-text {
		color: var(--muted);
		font-size: 14px;
	}

	.when {
		flex: none;
		color: var(--faint);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.when.fresh {
		color: var(--easy);
		font-weight: 500;
	}

	.empty {
		padding: 40px 12px;
		text-align: center;
	}

	.empty-title {
		margin: 0 0 8px;
		font-size: 17px;
		font-weight: 600;
	}

	.empty-text {
		max-width: 320px;
		margin: 0 auto;
		color: var(--muted);
		line-height: 1.45;
	}
</style>
