<script lang="ts">
	// iOS's colour picker, with two of its three ways in: the grid of colours, and the red, green
	// and blue of one — slid, or typed as a code.
	import { GRID, GRID_COLUMNS, isLight, parseColor, toHex, type Rgb } from '$lib/color';
	import Segmented from '$lib/Segmented.svelte';

	let {
		value,
		oninput,
		onchange
	}: {
		/** The colour picked so far, as `#rrggbb`. */
		value: string;
		/** A colour being tried: a slider on its way, or a code still being typed. */
		oninput: (color: string) => void;
		/** A colour picked. */
		onchange: (color: string) => void;
	} = $props();

	const CELLS = GRID.flat();
	const CHANNELS = [
		['R', 'Rojo'],
		['G', 'Verde'],
		['B', 'Azul']
	];
	const STEPS: Record<string, number> = {
		ArrowLeft: -1,
		ArrowRight: 1,
		ArrowUp: -GRID_COLUMNS,
		ArrowDown: GRID_COLUMNS
	};

	let mode = $state<'grid' | 'rgb'>('grid');

	// What the sliders show: the colour picked, until one of them moves.
	let rgb = $derived<Rgb>(parseColor(value) ?? [0, 0, 0]);
	// What is being typed as a code, until the field is left.
	let code = $state<string>();

	const picked = $derived(value.toLowerCase());
	// The one cell Tab stops at: the colour picked, or the first.
	const tabStop = $derived(Math.max(0, CELLS.indexOf(picked)));

	/** Arrow keys walk the grid, picking as they go, like any group of radio buttons. */
	function walk(event: KeyboardEvent & { currentTarget: HTMLButtonElement }, index: number) {
		const next = index + (STEPS[event.key] ?? NaN);
		if (!(next >= 0 && next < CELLS.length)) return;

		event.preventDefault();
		(event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
		onchange(CELLS[next]);
	}

	/** Each slider's track runs through its channel with the other two as they are. */
	function track(channel: number) {
		const end = (level: number) => `rgb(${rgb.map((c, i) => (i === channel ? level : c)).join(' ')})`;
		return `linear-gradient(to right, ${end(0)}, ${end(255)})`;
	}

	function slide(channel: number, level: number) {
		rgb = rgb.map((c, i) => (i === channel ? level : c)) as Rgb;
		oninput(toHex(rgb));
	}

	function type(text: string) {
		code = text;
		const typed = parseColor(text);
		if (!typed) return;
		rgb = typed;
		oninput(toHex(typed));
	}

	/** Leaving the field picks what it holds, or goes back to the colour picked before. */
	function leave() {
		if (code === undefined) return;

		const typed = parseColor(code);
		code = undefined;
		if (typed) {
			onchange(toHex(typed));
		} else {
			rgb = parseColor(value) ?? rgb;
			oninput(value);
		}
	}
</script>

<Segmented
	label="Forma de elegir"
	options={[
		['grid', 'Cuadrícula'],
		['rgb', 'RGB']
	]}
	bind:value={mode}
/>

<!-- Both stay laid out, one over the other, so the sheet keeps its height when switching. -->
<div class="panels">
	<div class="grid" class:hidden={mode !== 'grid'} role="radiogroup" aria-label="Colores">
		{#each CELLS as color, index (color)}
			<button
				type="button"
				role="radio"
				aria-checked={color === picked}
				aria-label={color.toUpperCase()}
				tabindex={index === tabStop ? 0 : -1}
				class:light={isLight(color)}
				style:background-color={color}
				onclick={() => onchange(color)}
				onkeydown={(event) => walk(event, index)}
			></button>
		{/each}
	</div>

	<div class="rgb" class:hidden={mode !== 'rgb'}>
		<div class="card">
			{#each CHANNELS as [letter, name], channel (letter)}
				<label class="channel">
					<span class="letter" aria-hidden="true">{letter}</span>
					<input
						type="range"
						min="0"
						max="255"
						aria-label={name}
						value={rgb[channel]}
						style:--track={track(channel)}
						oninput={(event) => slide(channel, event.currentTarget.valueAsNumber)}
						onchange={() => onchange(toHex(rgb))}
					/>
					<output>{rgb[channel]}</output>
				</label>
			{/each}

			<label class="code">
				<span>Código</span>
				<input
					type="text"
					value={code ?? toHex(rgb).toUpperCase()}
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					enterkeyhint="done"
					oninput={(event) => type(event.currentTarget.value)}
					onblur={leave}
					onkeydown={(event) => {
						if (event.key === 'Enter') event.currentTarget.blur();
					}}
				/>
			</label>
		</div>
		<p class="hint">Un código como #1C1446, o los tres valores de 0 a 255: 28, 20, 70.</p>
	</div>
</div>

<style>
	/* The colours are the settings sheet's own. */
	.panels {
		display: grid;
		margin-top: 16px;
	}

	.panels > * {
		grid-area: 1 / 1;
		min-width: 0;
	}

	.hidden {
		visibility: hidden;
	}

	/* One piece with rounded corners, the way iOS draws it, and cells that touch. */
	.grid {
		display: grid;
		grid-template-columns: repeat(12, 1fr);
		align-self: start;
		overflow: hidden;
		border-radius: 10px;
	}

	.grid button {
		aspect-ratio: 1;
		padding: 0;
		border: 0;
		border-radius: 0;
		cursor: pointer;
	}

	/* The colour picked is ringed in white, or in black where white would not show. */
	.grid button[aria-checked='true'] {
		position: relative;
		z-index: 1;
		border-radius: 4px;
		box-shadow:
			inset 0 0 0 2.5px #fff,
			0 0 0 1px rgb(0 0 0 / 0.2);
	}

	.grid button.light[aria-checked='true'] {
		box-shadow:
			inset 0 0 0 2.5px #000,
			0 0 0 1px rgb(255 255 255 / 0.4);
	}

	.grid button:focus-visible {
		position: relative;
		z-index: 2;
		outline: 2px solid var(--link);
		outline-offset: 1px;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		border-radius: 12px;
		background: var(--group);
	}

	.channel {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.letter {
		width: 1ch;
		color: var(--muted);
		font-size: 15px;
		font-weight: 600;
	}

	output {
		min-width: 3ch;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	/* A thick track painted with the channel's own range, under a ring that lets it show through. */
	input[type='range'] {
		flex: 1;
		min-width: 0;
		height: 28px;
		margin: 0;
		background: none;
		-webkit-appearance: none;
		appearance: none;
		cursor: pointer;
	}

	input[type='range']::-webkit-slider-runnable-track {
		height: 28px;
		border-radius: 14px;
		background: var(--track);
		box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.2);
	}

	input[type='range']::-moz-range-track {
		height: 28px;
		border-radius: 14px;
		background: var(--track);
		box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.2);
	}

	input[type='range']::-webkit-slider-thumb {
		width: 28px;
		height: 28px;
		box-sizing: border-box;
		border: 4px solid #fff;
		border-radius: 50%;
		background: transparent;
		box-shadow:
			0 0 0 0.5px rgb(0 0 0 / 0.2),
			0 2px 6px rgb(0 0 0 / 0.3);
		-webkit-appearance: none;
		appearance: none;
	}

	input[type='range']::-moz-range-thumb {
		width: 28px;
		height: 28px;
		box-sizing: border-box;
		border: 4px solid #fff;
		border-radius: 50%;
		background: transparent;
		box-shadow:
			0 0 0 0.5px rgb(0 0 0 / 0.2),
			0 2px 6px rgb(0 0 0 / 0.3);
	}

	input[type='range']:focus-visible {
		outline: 2px solid var(--link);
		outline-offset: 2px;
		border-radius: 14px;
	}

	.code {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-top: 14px;
		border-top: 0.5px solid var(--separator);
		font-size: 17px;
	}

	.code input {
		width: 9ch;
		min-width: 0;
		padding: 6px 10px;
		border: 0;
		border-radius: 8px;
		background: var(--fill);
		color: inherit;
		font: inherit;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.code input:focus {
		outline: 2px solid var(--link);
		outline-offset: 0;
	}

	.hint {
		margin: 8px 16px 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.35;
	}
</style>
