<script lang="ts">
	// A post's photos side by side, one screen wide each: swiped through on a phone, and with arrows
	// where there is a mouse, as Instagram has them. Scroll snapping does the swiping, so it moves
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

	.counter {
		position: absolute;
		top: 14px;
		right: 14px;
		padding: 3px 8px;
		border-radius: 12px;
		background: rgb(18 18 18 / 0.7);
		color: #fff;
		font-size: 12px;
		font-weight: 600;
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
		border: 0;
		border-radius: 50%;
		background: rgb(255 255 255 / 0.8);
		color: #262626;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.2);
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
