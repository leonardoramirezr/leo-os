<script lang="ts">
	// A program drawn as the treadmill's display draws one: a bar per segment, as wide as the segment
	// lasts and as tall as its speed, the fastest reaching the top. It fills whatever room it is given.
	import { lengthOf, segmentAt, type Segment } from '$lib/programs.svelte';

	interface Props {
		segments: Segment[];
		/**
		 * Seconds into the program, while it runs: the bars gone by are dimmed, the one running is
		 * solid and the ones to come are outlined, with the program's progress underneath. Without it
		 * every bar is drawn alike.
		 */
		at?: number;
		/** Pixels between two bars, so that two segments at one speed still read as two. */
		gap?: number;
	}

	let { segments, at, gap = 2 }: Props = $props();

	/** The progress bar under the bars, and the room above it. */
	const TRACK = 6;
	const ABOVE_TRACK = 8;

	let width = $state(0);
	let height = $state(0);

	const total = $derived(lengthOf(segments));
	const fastest = $derived(Math.max(0, ...segments.map((segment) => segment.speed)));
	/** The bar running; past the last one when the program is over, which leaves every bar gone by. */
	const current = $derived(
		at === undefined ? -1 : at >= total ? segments.length : segmentAt(segments, at).index
	);
	/** How tall the tallest bar is. */
	const room = $derived(height - (at === undefined ? 0 : TRACK + ABOVE_TRACK));

	const bars = $derived.by(() => {
		if (!width || room <= 0 || !total || !fastest) return [];

		let start = 0;
		return segments.map((segment, index) => {
			const left = (start / total) * width;
			start += segment.seconds;
			const right = (start / total) * width;
			const tall = Math.max(1, (segment.speed / fastest) * room);
			return {
				x: left + gap / 2,
				y: room - tall,
				width: Math.max(1, right - left - gap),
				height: tall,
				state: current < 0 ? 'plain' : index < current ? 'past' : index === current ? 'now' : 'next'
			};
		});
	});
</script>

<div class="profile" bind:clientWidth={width} bind:clientHeight={height}>
	{#if bars.length}
		<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
			{#each bars as bar, index (index)}
				<!-- A bar to come is outlined inside its own edges, so that it takes the room the others
				     do; one too thin for an outline is drawn half-faded instead. -->
				{@const outlined = bar.state === 'next' && bar.width > 3 && bar.height > 3}
				<rect
					class={bar.state}
					class:outlined
					x={outlined ? bar.x + 1 : bar.x}
					y={outlined ? bar.y + 1 : bar.y}
					width={outlined ? bar.width - 2 : bar.width}
					height={outlined ? bar.height - 2 : bar.height}
				/>
			{/each}
			{#if at !== undefined}
				<rect class="track" x="0" y={height - TRACK} {width} height={TRACK} />
				<rect class="done" x="0" y={height - TRACK} width={(at / total) * width} height={TRACK} />
			{/if}
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

	.past {
		opacity: 0.28;
	}

	.next {
		opacity: 0.5;
	}

	.next.outlined {
		opacity: 1;
		fill-opacity: 0.07;
		stroke: currentColor;
		stroke-width: 2;
	}

	.track {
		opacity: 0.14;
	}
</style>
