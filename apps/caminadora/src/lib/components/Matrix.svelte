<script lang="ts">
	// The program running, drawn on a dot matrix as a treadmill's display (or a Game Boy's) draws it:
	// a grid of square pixels, the ones off still faint. Each column is a slice of the program's time
	// and lights up to the speed of the segment it falls in, so a bar is as wide as its segment lasts
	// and as tall as its speed. The one running is solid, the ones gone by are a checkerboard — the
	// grey a screen of two shades can draw — and the ones to come are outlined, their sides dotted.
	// The bottom row is how far into the program it is.
	import { lengthOf, segmentAt, type Segment } from '$lib/programs.svelte';

	let { segments, at }: { segments: Segment[]; at: number } = $props();

	let width = $state(0);
	let height = $state(0);

	const total = $derived(lengthOf(segments));
	const fastest = $derived(Math.max(0, ...segments.map((segment) => segment.speed)));
	/** The segment running; past the last one when the program is over, which leaves all of them gone by. */
	const current = $derived(at >= total ? segments.length : segmentAt(segments, at).index);

	/** How far apart the pixels are: about thirty to the height, never so small they stop reading as dots. */
	const pitch = $derived(Math.min(12, Math.max(4, Math.round(Math.min(width / 56, height / 30)))));
	const dot = $derived(pitch - Math.max(1, Math.round(pitch * 0.18)));
	const columns = $derived(Math.floor(width / pitch));
	const rows = $derived(Math.floor(height / pitch));

	/** Every pixel, as two paths: the ones lit and the ones off. One shape each keeps it cheap to redraw. */
	const pixels = $derived.by(() => {
		let lit = '';
		let off = '';
		// The bars take every row but the last two: one left blank, then the progress.
		const tall = rows - 2;
		if (columns < 1 || tall < 1 || !total || !fastest) return { lit, off };

		// The grid is centred in its room.
		const left = (width - columns * pitch) / 2;
		const top = (height - rows * pitch) / 2;
		const square = (column: number, row: number) =>
			`M${(left + column * pitch).toFixed(1)} ${(top + row * pitch).toFixed(1)}h${dot}v${dot}h-${dot}z`;

		// Which segment each column falls in, by the middle of its slice of time.
		const owner = Array.from({ length: columns }, (_, column) =>
			segmentAt(segments, ((column + 0.5) / columns) * total).index
		);
		const done = Math.round((at / total) * columns);

		// The columns each segment is drawn in. Where it starts, a column is left dark, so that two
		// segments at one speed still read as two — unless that would leave it too thin to see.
		const from = new Map<number, number>();
		const to = new Map<number, number>();
		owner.forEach((index, column) => {
			if (!from.has(index)) from.set(index, column);
			to.set(index, column);
		});
		for (const [index, start] of from) {
			if (index > 0 && to.get(index)! - start >= 2) from.set(index, start + 1);
		}

		for (let column = 0; column < columns; column++) {
			const index = owner[column];
			const drawn = column >= from.get(index)!;
			const edge = column === from.get(index) || column === to.get(index);
			const bar = drawn ? Math.max(1, Math.round((segments[index].speed / fastest) * tall)) : 0;

			for (let row = 0; row < tall; row++) {
				const inside = row >= tall - bar;
				let on = false;
				if (inside && index === current) on = true;
				else if (inside && index < current) on = (row + column) % 2 === 0;
				// Sides dotted: one too narrow to be hollow must not look like the one running.
				else if (inside) on = row === tall - bar || (edge && (tall - row) % 2 === 1);
				if (on) lit += square(column, row);
				else off += square(column, row);
			}
			off += square(column, tall);
			if (column < done) lit += square(column, rows - 1);
			else off += square(column, rows - 1);
		}
		return { lit, off };
	});
</script>

<div class="matrix" bind:clientWidth={width} bind:clientHeight={height}>
	<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
		<path class="off" d={pixels.off} />
		<path d={pixels.lit} />
	</svg>
</div>

<style>
	/* Sized by whoever holds it; the drawing goes on top, so that it never pushes that size around. */
	.matrix {
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

	path {
		fill: currentColor;
	}

	/* As faint as the segments of the digits that are off. */
	.off {
		opacity: var(--ghost, 0.08);
	}
</style>
