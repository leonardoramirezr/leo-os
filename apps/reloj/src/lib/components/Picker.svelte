<script lang="ts" module>
	/** The timer's three columns: how many milliseconds one step of each is worth, and how many it has. */
	const COLUMNS = [
		{ name: 'h', label: 'Horas', step: 3600 * 1000, count: 24 },
		{ name: 'min', label: 'Minutos', step: 60 * 1000, count: 60 },
		{ name: 's', label: 'Segundos', step: 1000, count: 60 }
	] as const;

	type Column = (typeof COLUMNS)[number];

	/** A press held down steps on by itself: first after a pause, then quickly. */
	const HOLD = 420;
	const REPEAT = 70;
</script>

<script lang="ts">
	// The length of the timer, from 00:00:01 to 23:59:59: each column steps up and down on its
	// own and goes round past its end, as a watch's setting mode does.
	import Digits from './Digits.svelte';
	import Icon from './Icon.svelte';

	let { value = $bindable() }: { value: number } = $props();

	function part(column: Column): number {
		return Math.floor(value / column.step) % column.count;
	}

	function step(column: Column, by: number) {
		const now = part(column);
		const next = (now + by + column.count) % column.count;
		value += (next - now) * column.step;
	}

	let held: ReturnType<typeof setTimeout> | undefined;

	function press(event: PointerEvent, column: Column, by: number) {
		if (event.button !== 0) return;
		// No focus ring, and no click after it: the press did the step already.
		event.preventDefault();
		step(column, by);
		const again = (delay: number) => {
			held = setTimeout(() => {
				step(column, by);
				again(REPEAT);
			}, delay);
		};
		again(HOLD);
	}

	function release() {
		clearTimeout(held);
	}

	/** A click that came from no press: the keyboard's Enter or Space on the focused arrow. */
	function click(event: MouseEvent, column: Column, by: number) {
		if (event.detail === 0) step(column, by);
	}
</script>

<svelte:window onpointerup={release} onpointercancel={release} onblur={release} />

<div class="picker" role="group" aria-label="Duración">
	{#each COLUMNS as column, index (column.name)}
		{#if index}
			<span class="separator digits" aria-hidden="true">
				<Digits value=":" />
			</span>
		{/if}
		<div class="column">
			<button
				class="arrow"
				aria-label="Más {column.label.toLowerCase()}"
				onpointerdown={(event) => press(event, column, 1)}
				onclick={(event) => click(event, column, 1)}
				oncontextmenu={(event) => event.preventDefault()}
			>
				<Icon name="up" size={26} stroke={3} />
			</button>
			<span class="digits">
				<Digits value={String(part(column)).padStart(2, '0')} label="{part(column)} {column.label.toLowerCase()}" />
			</span>
			<button
				class="arrow"
				aria-label="Menos {column.label.toLowerCase()}"
				onpointerdown={(event) => press(event, column, -1)}
				onclick={(event) => click(event, column, -1)}
				oncontextmenu={(event) => event.preventDefault()}
			>
				<Icon name="down" size={26} stroke={3} />
			</button>
			<span class="label">{column.name}</span>
		</div>
	{/each}
</div>

<style>
	.picker {
		display: grid;
		grid-template-columns: 1fr auto 1fr auto 1fr;
		align-items: center;
		gap: 2px;
		font-size: var(--pick);
	}

	.column {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.separator {
		/* Level with the digits, which the label under the lower arrow pushes up by half its height. */
		padding-bottom: 22px;
	}

	.arrow {
		display: grid;
		place-items: center;
		width: 100%;
		max-width: 96px;
		height: 42px;
		padding: 0;
		border: 2px solid var(--ink);
		border-radius: 10px;
		background: transparent;
		color: var(--ink);
		touch-action: manipulation;
		-webkit-touch-callout: none;
	}

	.arrow:active {
		background: var(--ink);
		color: var(--paper);
	}

	.label {
		opacity: 0.75;
		text-transform: none;
	}
</style>
