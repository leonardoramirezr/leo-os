<script lang="ts" module>
	// The numbers of a digital watch's display: seven segments each, the ones that are off still
	// faintly there, as on an LCD. Drawn rather than set in a font, which would have to be downloaded.
	// The same as Caminadora's, plus the hundredths drawn smaller, as a stopwatch draws them.
	//
	// Its height is the font size around it, so a digit is sized like text.

	/** A digit's box, how thick a segment is and the gap left where two of them meet. */
	const W = 12;
	const H = 21;
	const T = 2.6;
	const G = 0.4;
	/** The colon's box and the decimal point's: narrower than a digit. */
	const COLON = 4;
	const DOT = 3.4;
	/** Between one character and the next. */
	const SPACE = 2.2;
	/** The digits lean, as an LCD's do: how far the top of one is to the right of its bottom. */
	const SLANT = 5;
	const LEAN = H * Math.tan((SLANT * Math.PI) / 180);
	/** How big the characters from `small` on are, sitting on the same line as the rest. */
	const SMALL = 0.55;

	type Point = [number, number];

	function polygon(points: Point[]): string {
		return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
	}

	/** A segment across, along the line at height `y`, pointed at both ends. */
	function across(y: number): string {
		const [left, right] = [T / 2 + G, W - T / 2 - G];
		return polygon([
			[left, y],
			[left + T / 2, y - T / 2],
			[right - T / 2, y - T / 2],
			[right, y],
			[right - T / 2, y + T / 2],
			[left + T / 2, y + T / 2]
		]);
	}

	/** A segment down, along the line at `x` from `top` to `bottom`, pointed at both ends. */
	function down(x: number, top: number, bottom: number): string {
		const [start, end] = [top + G, bottom - G];
		return polygon([
			[x, start],
			[x + T / 2, start + T / 2],
			[x + T / 2, end - T / 2],
			[x, end],
			[x - T / 2, end - T / 2],
			[x - T / 2, start + T / 2]
		]);
	}

	/** The seven, by the letters they always go by: a on top, then clockwise, g in the middle. */
	const SEGMENTS = [
		['a', across(T / 2)],
		['b', down(W - T / 2, T / 2, H / 2)],
		['c', down(W - T / 2, H / 2, H - T / 2)],
		['d', across(H - T / 2)],
		['e', down(T / 2, H / 2, H - T / 2)],
		['f', down(T / 2, T / 2, H / 2)],
		['g', across(H / 2)]
	] as const;

	/** The segments each character lights. A space lights none, and leaves its digit faint. */
	const GLYPHS: Record<string, string> = {
		'0': 'abcdef',
		'1': 'bc',
		'2': 'abdeg',
		'3': 'abcdg',
		'4': 'bcfg',
		'5': 'acdfg',
		'6': 'acdefg',
		'7': 'abc',
		'8': 'abcdefg',
		'9': 'abcdfg',
		'-': 'g',
		' ': '',
		F: 'aefg',
		I: 'ef',
		n: 'ceg'
	};

	function layout(text: string, small: number) {
		let x = 0;
		let space = 0;
		const cells = [...text].map((char, index) => {
			const scale = index < small ? 1 : SMALL;
			const cell = { char, x, scale };
			space = SPACE * scale;
			x += (char === ':' ? COLON : char === '.' ? DOT : W) * scale + space;
			return cell;
		});
		return { cells, width: Math.max(0, x - space) + LEAN };
	}
</script>

<script lang="ts">
	/**
	 * Digits, spaces, «-», «:» and «.», and the letters of «FIn». `label` is what is read aloud, and
	 * the characters from `small` on are drawn smaller.
	 */
	let { value, label, small = Infinity }: { value: string; label?: string; small?: number } = $props();

	const shape = $derived(layout(value, small));
</script>

<svg viewBox="0 0 {shape.width.toFixed(2)} {H}" role="img" aria-label={label ?? value}>
	{#each shape.cells as cell, index (index)}
		<g
			transform="translate({(cell.x + LEAN).toFixed(2)} {(H * (1 - cell.scale)).toFixed(2)}) scale({cell.scale}) skewX(-{SLANT})"
		>
			{#if cell.char === ':'}
				<rect x={(COLON - T) / 2} y={H * 0.3 - T / 2} width={T} height={T} />
				<rect x={(COLON - T) / 2} y={H * 0.7 - T / 2} width={T} height={T} />
			{:else if cell.char === '.'}
				<rect x={(DOT - T) / 2} y={H - T} width={T} height={T} />
			{:else}
				{#each SEGMENTS as [name, points] (name)}
					<polygon {points} class:off={!GLYPHS[cell.char]?.includes(name)} />
				{/each}
			{/if}
		</g>
	{/each}
</svg>

<style>
	svg {
		display: block;
		width: auto;
		max-width: 100%;
		height: 1em;
		fill: currentColor;
	}

	.off {
		opacity: var(--ghost, 0.08);
	}
</style>
