<script lang="ts">
	import { MediaQuery, SvelteSet } from 'svelte/reactivity';
	import { fly } from 'svelte/transition';
	import { HomeButton } from '@leo-os/shared';
	import { collection, type Deck } from '$lib/collection.svelte';
	import { formatWait, plural } from '$lib/format';
	import { ratings, wait, type Rating } from '$lib/schedule';
	import CardSheet from './CardSheet.svelte';
	import Icon from './Icon.svelte';

	let { deck }: { deck: Deck } = $props();

	const labels: Record<Rating, string> = {
		again: 'Otra vez',
		hard: 'Difícil',
		good: 'Bien',
		easy: 'Fácil'
	};

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

	/** The card on screen, by id: the collection's copy is the one kept up to date. */
	let currentId = $state<string>();
	/** When it was put on screen. Every card gets an element of its own, keyed by this. */
	let shownAt = $state(Date.now());
	let revealed = $state(false);
	let answered = $state(0);
	let editing = $state(false);
	let editButton = $state<HTMLButtonElement>();

	/** The different cards answered in this session, for the summary at the end. */
	const studied = new SvelteSet<string>();
	let previousId: string | undefined;

	const card = $derived(collection.cards.find((candidate) => candidate.id === currentId));
	const remaining = $derived(collection.dueIn(deck.id, shownAt).length);
	// A card answered «Otra vez» comes back, so the bar may step back a little: that is the truth.
	const progress = $derived(answered + remaining ? answered / (answered + remaining) : 1);

	function advance() {
		const now = Date.now();
		const queue = collection.dueIn(deck.id, now);
		// The card just answered is not shown twice in a row while there is another one to show.
		currentId = (queue.find((candidate) => candidate.id !== previousId) ?? queue[0])?.id;
		shownAt = now;
		revealed = false;
	}

	advance();

	// A card deleted while on screen, from here or from another device, leaves its place to the next.
	$effect(() => {
		if (currentId && !card) advance();
	});

	function reveal() {
		revealed = true;
	}

	function rate(rating: Rating) {
		if (!card || !revealed) return;

		collection.answer(card.id, rating);
		studied.add(card.id);
		answered++;
		previousId = card.id;
		advance();
	}

	function close() {
		history.back();
	}

	/** Short text is shown large; long text small enough to fit on the card. */
	function size(text: string): string {
		if (text.length <= 40) return 'large';
		return text.length <= 160 ? 'medium' : 'small';
	}

	function summary(): string {
		const next = collection.nextDue(deck.id);
		const back = next ? ` La próxima tarjeta vuelve en ${formatWait(next - Date.now())}.` : '';
		if (!studied.size) return `Este mazo está al día.${back}`;
		return `Repasaste ${plural(studied.size, 'tarjeta', 'tarjetas')}.${back}`;
	}

	// Space or Enter shows the answer and then counts as «Bien»; 1 to 4 are the four answers, as in Anki.
	function onkeydown(event: KeyboardEvent) {
		if (editing || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('input, textarea, select')) return;

		if (event.key === 'Escape') return close();
		if (!card) return;

		if (event.key === ' ' || event.key === 'Enter') {
			// A focused button answers to these by itself: Enter on «Difícil» means «Difícil».
			if (target?.closest('button, a')) return;
			event.preventDefault();
			if (revealed) rate('good');
			else reveal();
		} else if (revealed && /^[1-4]$/.test(event.key)) {
			rate(ratings[Number(event.key) - 1]);
		}
	}

	// Closing the sheet hands the focus back to the button that opened it, where Space would open the
	// sheet again. It goes back to the page instead, where Space shows the answer.
	$effect(() => {
		if (editing) return;
		setTimeout(() => {
			if (document.activeElement === editButton) editButton?.blur();
		});
	});
</script>

<svelte:window {onkeydown} />

<div class="study">
	<header class="top">
		<button class="icon-button" onclick={close} aria-label="Terminar" title="Terminar (Esc)">
			<Icon name="close" size={22} />
		</button>
		<div
			class="progress"
			role="progressbar"
			aria-label="Avance"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(progress * 100)}
		>
			<span style:width="{progress * 100}%"></span>
		</div>
		<span class="remaining" title="Por estudiar">{remaining}</span>
		<button
			bind:this={editButton}
			class="icon-button"
			onclick={() => (editing = true)}
			disabled={!card}
			aria-label="Editar tarjeta"
			title="Editar tarjeta"
			aria-haspopup="dialog"
		>
			<Icon name="edit" />
		</button>
		<HomeButton />
	</header>

	{#if card}
		<main class="stage">
			{#key shownAt}
				<!-- The card slides in on a wrapper of its own: both movements are transforms, and on the
				     same element the slide would hold back a flip asked for straight away. -->
				<div class="slot" in:fly={{ y: 24, duration: reducedMotion.current ? 0 : 240 }}>
					<!-- Tapping the card is a shortcut: the button below and the Space key are the way in for
					     keyboards and screen readers. -->
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<div class="card" class:revealed onclick={reveal}>
						<div class="face front" aria-hidden={revealed}>
							<div class="content">
								<p class="text {size(card.front)}">{card.front}</p>
							</div>
						</div>
						<div class="face back" aria-hidden={!revealed}>
							<div class="content">
								<p class="question">{card.front}</p>
								<p class="text {size(card.back)}">{card.back}</p>
							</div>
						</div>
					</div>
				</div>
			{/key}
		</main>

		<footer class="controls">
			{#if revealed}
				<div class="answers">
					{#each ratings as rating, index (rating)}
						<button
							class="answer {rating}"
							onclick={() => rate(rating)}
							title="{labels[rating]} ({index + 1})"
						>
							<span class="label">{labels[rating]}</span>
							<span class="wait">{formatWait(wait(card, rating, shownAt))}</span>
						</button>
					{/each}
				</div>
			{:else}
				<button class="primary reveal" onclick={reveal} title="Mostrar respuesta (espacio)">
					Mostrar respuesta
				</button>
			{/if}
		</footer>
	{:else}
		<main class="finished">
			<span class="check"><Icon name="check" size={40} stroke={2.5} /></span>
			<h1>{studied.size ? '¡Listo por hoy!' : 'Nada que repasar'}</h1>
			<p>{summary()}</p>
			<button class="primary" onclick={close}>Volver al mazo</button>
		</main>
	{/if}
</div>

<CardSheet bind:open={editing} deckId={deck.id} {card} />

<style>
	.study {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		max-width: 640px;
		margin: 0 auto;
		padding: calc(env(safe-area-inset-top) + 6px) 16px calc(env(safe-area-inset-bottom) + 16px);
	}

	.top {
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
		margin: 0 -8px;
	}

	.progress {
		flex: 1;
		height: 6px;
		overflow: hidden;
		border-radius: 3px;
		background: color-mix(in srgb, var(--text) 10%, transparent);
	}

	.progress span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
		transition: width 0.35s ease;
	}

	.remaining {
		min-width: 24px;
		color: var(--muted);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.stage {
		display: grid;
		flex: 1;
		min-height: 0;
		grid-template: minmax(0, 1fr) / minmax(0, 1fr);
		align-items: center;
		padding: 16px 0 20px;
	}

	.slot {
		height: min(100%, 540px);
		perspective: 1400px;
	}

	.card {
		position: relative;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform 0.55s cubic-bezier(0.3, 0.7, 0.2, 1);
		cursor: pointer;
	}

	.card.revealed {
		transform: rotateY(180deg);
		cursor: auto;
	}

	/* The scroller is inside each face: Safari loses backface-visibility on an element that scrolls. */
	.face {
		position: absolute;
		inset: 0;
		display: flex;
		border-radius: 28px;
		background: var(--group);
		box-shadow: var(--lift);
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}

	.back {
		transform: rotateY(180deg);
	}

	.content {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 18px;
		overflow-y: auto;
		padding: 32px 24px;
		text-align: center;
	}

	/* Centred with margins rather than justify-content, which would cut off the top of a long text. */
	.content > :first-child {
		margin-top: auto;
	}

	.content > :last-child {
		margin-bottom: auto;
	}

	.text {
		margin: 0;
		font-weight: 600;
		line-height: 1.3;
		letter-spacing: -0.01em;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.text.large {
		font-size: 30px;
	}

	.text.medium {
		font-size: 22px;
	}

	.text.small {
		font-size: 17px;
		font-weight: 500;
		line-height: 1.5;
		text-align: left;
	}

	.question {
		margin: 0;
		color: var(--muted);
		font-size: 15px;
		line-height: 1.4;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.question::after {
		content: '';
		display: block;
		width: 36px;
		height: 3px;
		margin: 16px auto 0;
		border-radius: 2px;
		background: var(--border);
	}

	.controls {
		display: flex;
		flex: none;
		align-items: flex-end;
		min-height: 64px;
	}

	.reveal {
		height: 58px;
	}

	.answers {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
		width: 100%;
	}

	.answer {
		--tone: var(--good);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		height: 64px;
		padding: 6px 2px;
		border: 0;
		border-radius: 16px;
		background: color-mix(in srgb, var(--tone) 14%, var(--group));
		color: var(--tone);
		transition: transform 0.1s;
	}

	.answer:active {
		transform: scale(0.95);
	}

	.answer.again {
		--tone: var(--again);
	}

	.answer.hard {
		--tone: var(--hard);
	}

	.answer.easy {
		--tone: var(--easy);
	}

	.label {
		font-size: 15px;
		font-weight: 600;
		white-space: nowrap;
	}

	.wait {
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	.finished {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 24px;
		text-align: center;
	}

	.check {
		display: grid;
		place-items: center;
		width: 84px;
		height: 84px;
		margin-bottom: 12px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--good) 16%, transparent);
		color: var(--good);
	}

	.finished h1 {
		margin: 0;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.finished p {
		max-width: 300px;
		margin: 0 0 20px;
		color: var(--muted);
		line-height: 1.45;
	}

	.finished .primary {
		max-width: 280px;
	}

	@media (prefers-reduced-motion: reduce) {
		.card {
			transition: none;
		}
	}
</style>
