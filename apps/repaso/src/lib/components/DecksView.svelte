<script lang="ts">
	import icon from '../../../icon.svg';
	import { pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { collection, type Deck } from '$lib/collection.svelte';
	import { plural } from '$lib/format';
	import DeckSheet from './DeckSheet.svelte';
	import Icon from './Icon.svelte';
	import SettingsSheet from './SettingsSheet.svelte';

	let creating = $state(false);
	let settingsOpen = $state(false);

	/** Every card waiting across the decks: the new ones and the ones due again. */
	const waiting = $derived(
		collection.decks.reduce((sum, deck) => {
			const counts = collection.countsOf(deck.id);
			return sum + counts.new + counts.due;
		}, 0)
	);

	const caption = $derived.by(() => {
		if (waiting) return `${plural(waiting, 'tarjeta', 'tarjetas')} para hoy`;
		return collection.cards.length ? 'Todo al día' : 'Aún no hay tarjetas';
	});

	function open(deck: Deck) {
		pushState('', { deck: deck.id });
	}
</script>

<div class="screen">
	<header class="bar">
		<a class="icon-button" href="{resolve('/')}../" aria-label="Apps" title="Apps" data-sveltekit-reload>
			<Icon name="apps" />
		</a>
		<button
			class="icon-button"
			onclick={() => (settingsOpen = true)}
			aria-label="Ajustes"
			title="Ajustes"
			aria-haspopup="dialog"
		>
			<Icon name="settings" />
		</button>
	</header>

	<h1>Repaso</h1>

	{#if collection.decks.length}
		<p class="caption">{caption}</p>

		<ul class="decks">
			{#each collection.sortedDecks as deck (deck.id)}
				{@const counts = collection.countsOf(deck.id)}
				{@const pending = counts.new + counts.due}
				<li>
					<button class="deck" onclick={() => open(deck)}>
						<span class="text">
							<span class="name">{deck.name}</span>
							<span class="meta">
								{counts.total ? plural(counts.total, 'tarjeta', 'tarjetas') : 'Sin tarjetas'}
							</span>
						</span>
						{#if pending}
							<span class="badge" title="Por estudiar hoy">{pending}</span>
						{:else if counts.total}
							<span class="up-to-date" title="Al día">
								<Icon name="check" size={18} stroke={2.5} />
							</span>
						{/if}
						<span class="chevron"><Icon name="forward" size={18} /></span>
					</button>
				</li>
			{/each}
			<li>
				<button class="deck add" onclick={() => (creating = true)}>
					<Icon name="plus" />
					Nuevo mazo
				</button>
			</li>
		</ul>
	{:else}
		<div class="empty">
			<img class="logo" src={icon} alt="" width="84" height="84" />
			<p class="empty-title">Crea tu primer mazo</p>
			<p class="empty-text">
				Un mazo reúne las tarjetas de un tema. Escríbelas a mano o deja que la IA las escriba por ti, y
				repásalas justo antes de olvidarlas.
			</p>
			<button class="primary" onclick={() => (creating = true)}>Nuevo mazo</button>
		</div>
	{/if}
</div>

<DeckSheet bind:open={creating} oncreate={open} />
<SettingsSheet bind:open={settingsOpen} />

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

	.decks {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.deck {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 74px;
		padding: 14px 12px 14px 18px;
		border: 0;
		border-radius: 18px;
		background: var(--group);
		box-shadow: var(--shadow);
		text-align: left;
		transition: transform 0.12s;
	}

	.deck:active {
		transform: scale(0.98);
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
	}

	.name {
		overflow: hidden;
		font-size: 17px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		color: var(--muted);
		font-size: 14px;
	}

	.badge {
		min-width: 32px;
		padding: 4px 10px;
		border-radius: 999px;
		background: var(--accent);
		color: #fff;
		font-size: 15px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.up-to-date {
		color: var(--good);
	}

	.chevron {
		color: var(--faint);
	}

	.deck.add {
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
		max-width: 330px;
		margin: 0 0 24px;
		color: var(--muted);
		line-height: 1.5;
	}

	.empty .primary {
		max-width: 280px;
	}
</style>
