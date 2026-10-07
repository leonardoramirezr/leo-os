<script lang="ts">
	// The program running, drawn on a dot matrix as a treadmill's display (or a Game Boy's) draws it:
	// a grid of square pixels, the ones off still faint. Each segment is a bar three pixels wide for
	// every half minute it lasts, a dark column between two, and as tall as its speed. The ones gone
	// by are solid; the one running has its edge lit and its middle blinking; the ones to come are
	// outlined, their sides dotted, so that the one running never looks like them. The bottom row is
	// how far into the program it is.
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

	/** The columns of the whole program, side by side: three for every half minute, one dark between two. */
	const strip = $derived.by(() => {
		const starts: number[] = [];
		const widths: number[] = [];
		let x = 0;
		for (const segment of segments) {
			starts.push(x);
			widths.push(3 * Math.max(1, Math.ceil(segment.seconds / 30)));
			x += widths[widths.length - 1] + 1;
		}
		return { starts, widths, length: Math.max(0, x - 1) };
	});

	/** How far along the strip the program is, in columns. */
	const playhead = $derived.by(() => {
		if (current >= segments.length) return strip.length;
		const { start } = segmentAt(segments, at);
		return strip.starts[current] + ((at - start) / segments[current].seconds) * strip.widths[current];
	});

	/**
	 * The column of the strip at the left edge. The program starts flush left; when it is wider than the
	 * matrix it slides along, keeping where it is a third of the way in, until its end reaches the right.
	 */
	const scroll = $derived(
		Math.max(0, Math.min(strip.length - columns, Math.round(playhead - Math.floor(columns / 3))))
	);

	/** Every pixel, as three paths: lit, off and blinking. One shape each keeps it cheap to redraw. */
	const pixels = $derived.by(() => {
		let lit = '';
		let off = '';
		let blink = '';
		// The bars take every row but the last two: one left blank, then the progress.
		const tall = rows - 2;
		if (columns < 1 || tall < 1 || !total || !fastest) return { lit, off, blink };

		// The grid is centred in its room.
		const left = (width - columns * pitch) / 2;
		const top = (height - rows * pitch) / 2;
		const square = (column: number, row: number) =>
			`M${(left + column * pitch).toFixed(1)} ${(top + row * pitch).toFixed(1)}h${dot}v${dot}h-${dot}z`;

		// Which segment each column of the strip is in; the dark ones between two are in none.
		const owner = new Array<number>(strip.length).fill(-1);
		strip.starts.forEach((start, index) => owner.fill(index, start, start + strip.widths[index]));
		const done = Math.round(playhead);

		for (let column = 0; column < columns; column++) {
			const x = column + scroll;
			const index = owner[x] ?? -1;
			const start = strip.starts[index];
			const edge = index >= 0 && (x === start || x === start + strip.widths[index] - 1);
			const bar = index >= 0 ? Math.max(1, Math.round((segments[index].speed / fastest) * tall)) : 0;

			for (let row = 0; row < tall; row++) {
				const inside = row >= tall - bar;
				const rim = edge || row === tall - bar;
				let on = false;
				if (inside && index < current) on = true;
				else if (inside && index === current) {
					if (!rim) {
						blink += square(column, row);
						continue;
					}
					on = true;
				} else if (inside) on = row === tall - bar || (edge && (tall - row) % 2 === 1);
				if (on) lit += square(column, row);
				else off += square(column, row);
			}
			off += square(column, tall);
			if (x < done) lit += square(column, rows - 1);
			else off += square(column, rows - 1);
		}
		return { lit, off, blink };
	});
</script>

<div class="matrix" bind:clientWidth={width} bind:clientHeight={height}>
	<svg {width} {height} viewBox="0 0 {width} {height}" aria-hidden="true">
		<path class="off" d={pixels.off} />
		<path d={pixels.lit} />
		<path class="blink" d={pixels.blink} />
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

	/* On and off, never in between, as a display's pixel does. */
	.blink {
		animation: blink 1s steps(1, end) infinite;
	}

	@keyframes blink {
		50% {
			opacity: var(--ghost, 0.08);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.blink {
			animation: none;
			opacity: 0.45;
		}
	}
</style>
