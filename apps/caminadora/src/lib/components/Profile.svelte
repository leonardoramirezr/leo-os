<script lang="ts">
	// A program in a few bars, for the list and the editor: one per segment, as wide as the segment
	// lasts and as tall as its speed, the fastest reaching the top. It fills whatever room it is given.
	// The program running is drawn on a dot matrix instead (Matrix.svelte).
	import { lengthOf, type Segment } from '$lib/programs.svelte';

	interface Props {
		segments: Segment[];
		/** Pixels between two bars, so that two segments at one speed still read as two. */
		gap?: number;
	}

	let { segments, gap = 2 }: Props = $props();

	let width = $state(0);
	let height = $state(0);

	const total = $derived(lengthOf(segments));
	const fastest = $derived(Math.max(0, ...segments.map((segment) => segment.speed)));

	const bars = $derived.by(() => {
		if (!width || !height || !total || !fastest) return [];

		let start = 0;
		return segments.map((segment) => {
			const left = (start / total) * width;
			start += segment.seconds;
			const right = (start / total) * width;
			const tall = Math.max(1, (segment.speed / fastest) * height);
			return { x: left + gap / 2, y: height - tall, width: Math.max(1, right - left - gap), height: tall };
		});
	});
</script>

<div class="profile" bind:clientWidth={width} bind:clientHeight={height}>
	{#if bars.length}
		<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
			{#each bars as bar, index (index)}
				<rect x={bar.x} y={bar.y} width={bar.width} height={bar.height} />
			{/each}
		</svg>
	{/if}
</div>

<style>
	/* Sized by whoever holds it; the drawing goes on top, so that it never pushes that size around. */
	.profile {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	svg {
		position: absolute;
		inset: 0;
		display: block;
	}

	rect {
		fill: currentColor;
	}
</style>
