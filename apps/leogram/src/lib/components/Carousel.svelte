<script lang="ts">
	// A post's photos side by side, one screen wide each: swiped through on a phone, and with arrows
	// where there is a mouse. Scroll snapping does the swiping, so it moves
	// with the finger the way the system's own scrolling does.
	import type { Snippet } from 'svelte';
	import { ASPECTS, type Aspect } from '$lib/images';
	import Icon from './Icon.svelte';

	let {
		count,
		aspect,
		index = $bindable(0),
		slide,
		overlay,
		ondoubletap
	}: {
		count: number;
		aspect: Aspect;
		/** The photo showing, from 0. */
		index?: number;
		slide: Snippet<[number]>;
		/** Drawn over the photos: what stays put while they move. */
		overlay?: Snippet;
		ondoubletap?: () => void;
	} = $props();

	let track: HTMLDivElement;
	let lastTap = 0;

	function onscroll() {
		index = Math.min(count - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth)));
	}

	function go(to: number) {
		track.scrollTo({ left: to * track.clientWidth, behavior: 'smooth' });
	}

	// Two taps close together are a double tap. Taken from clicks, which a swipe never makes.
	function onclick() {
		const now = performance.now();
		if (now - lastTap < 320) {
			lastTap = 0;
			ondoubletap?.();
		} else {
			lastTap = now;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight' && index < count - 1) go(index + 1);
		if (event.key === 'ArrowLeft' && index > 0) go(index - 1);
	}
</script>

<div class="carousel" style:aspect-ratio={ASPECTS[aspect]}>
	<!-- Focusable for the arrow keys. A double tap is only a shortcut: the heart under it likes too. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		class="track"
		bind:this={track}
		{onscroll}
		{onclick}
		{onkeydown}
		tabindex={count > 1 ? 0 : -1}
		role="region"
		aria-roledescription="carrusel"
		aria-label="Fotos de la publicación"
	>
		{#each Array.from({ length: count }, (_, i) => i) as i (i)}
			<div class="slide" aria-label="{i + 1} de {count}" aria-hidden={i !== index}>
				{@render slide(i)}
			</div>
		{/each}
	</div>

	{#if count > 1}
		<span class="counter">{index + 1}/{count}</span>
		{#if index > 0}
			<button class="arrow previous" type="button" onclick={() => go(index - 1)} aria-label="Anterior">
				<Icon name="back" size={16} stroke={3} />
			</button>
		{/if}
		{#if index < count - 1}
			<button class="arrow next" type="button" onclick={() => go(index + 1)} aria-label="Siguiente">
				<Icon name="forward" size={16} stroke={3} />
			</button>
		{/if}
	{/if}

	{@render overlay?.()}
</div>

<style>
	.carousel {
		position: relative;
		width: 100%;
		overflow: hidden;
		background: var(--placeholder);
	}

	.track {
		display: flex;
		width: 100%;
		height: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		/* No double-tap zoom, so that two taps are a like. */
		touch-action: pan-x pan-y;
	}

	.track::-webkit-scrollbar {
		display: none;
	}

	.track:focus-visible {
		outline-offset: -2px;
	}

	.slide {
		position: relative;
		flex: 0 0 100%;
		height: 100%;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}

	/* Stickers on the photo, as the grid's are. */
	.counter {
		position: absolute;
		top: 12px;
		right: 12px;
		padding: 5px 9px 4px;
		border: 2px solid var(--ink);
		border-radius: 999px;
		background: var(--lilac);
		color: var(--on-lilac);
		font: 700 11px/1 var(--mono);
		pointer-events: none;
	}

	/* Only where there is a mouse: a finger swipes. */
	.arrow {
		display: none;
		position: absolute;
		top: 50%;
		place-items: center;
		width: 30px;
		height: 30px;
		margin-top: -15px;
		padding: 0;
		border: 2px solid var(--ink);
		border-radius: 50%;
		background: var(--card);
		color: var(--text);
		box-shadow: 2px 2px 0 var(--ink);
	}

	@media (hover: hover) {
		.arrow {
			display: grid;
		}
	}

	.previous {
		left: 10px;
	}

	.next {
		right: 10px;
	}
</style>
