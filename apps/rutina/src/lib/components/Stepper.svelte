<script lang="ts">
	// A number with − and + on either side. Held down, a button keeps stepping, so that three minutes
	// of rest are one press and not twelve taps; the number itself can also be typed.
	let {
		value = $bindable(),
		min,
		max,
		step = 1,
		label,
		precision = 1,
		format = String,
		parse = (text: string) => {
			const number = Number(text.trim().replace(',', '.'));
			return text.trim() && Number.isFinite(number) ? number : undefined;
		}
	}: {
		value: number;
		min: number;
		max: number;
		step?: number;
		/** What the number is, for screen readers. */
		label: string;
		/** What a typed value is rounded to: 1 for whole numbers, 0.25 for a weight in kilograms. */
		precision?: number;
		format?: (value: number) => string;
		/** Reads what was typed; `undefined` leaves the value as it was. */
		parse?: (text: string) => number | undefined;
	} = $props();

	let text = $state('');
	let editing = $state(false);
	let holding: ReturnType<typeof setTimeout> | undefined;

	const shown = $derived(editing ? text : format(value));

	function clamp(next: number): number {
		const rounded = Math.round(next / precision) * precision;
		return Math.min(max, Math.max(min, Number(rounded.toFixed(2))));
	}

	function nudge(direction: 1 | -1) {
		// From a value off the step, the first nudge lands on it: 50 goes to 45 or 60, not 35 or 65.
		const next = direction > 0 ? Math.floor(value / step) * step + step : Math.ceil(value / step) * step - step;
		value = clamp(next);
	}

	function press(direction: 1 | -1) {
		nudge(direction);
		let delay = 400;
		const repeat = () => {
			nudge(direction);
			delay = Math.max(60, delay * 0.8);
			holding = setTimeout(repeat, delay);
		};
		holding = setTimeout(repeat, delay);
	}

	function release() {
		clearTimeout(holding);
		holding = undefined;
	}

	function commit() {
		const parsed = parse(text);
		if (parsed !== undefined) value = clamp(parsed);
		editing = false;
	}
</script>

<div class="stepper">
	<button
		type="button"
		aria-label="Menos"
		disabled={value <= min}
		onpointerdown={(event) => {
			event.preventDefault();
			press(-1);
		}}
		onpointerup={release}
		onpointerleave={release}
		onpointercancel={release}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				nudge(-1);
			}
		}}
	>
		−
	</button>
	<input
		type="text"
		aria-label={label}
		value={shown}
		inputmode={precision < 1 ? 'decimal' : 'numeric'}
		onfocus={(event) => {
			// The event lets go of its target once it is handled: hold on to the field for the next frame.
			const input = event.currentTarget;
			text = String(value);
			editing = true;
			requestAnimationFrame(() => input.select());
		}}
		oninput={(event) => (text = event.currentTarget.value)}
		onblur={commit}
		onkeydown={(event) => {
			if (event.key === 'Enter') event.currentTarget.blur();
		}}
	/>
	<button
		type="button"
		aria-label="Más"
		disabled={value >= max}
		onpointerdown={(event) => {
			event.preventDefault();
			press(1);
		}}
		onpointerup={release}
		onpointerleave={release}
		onpointercancel={release}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				nudge(1);
			}
		}}
	>
		+
	</button>
</div>

<style>
	.stepper {
		display: flex;
		align-items: center;
		flex: none;
		overflow: hidden;
		border-radius: 10px;
		background: var(--hover);
	}

	button {
		width: 40px;
		height: 36px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--tint);
		font-size: 22px;
		line-height: 1;
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		/* Held down for the repeat, iOS would otherwise offer to copy the sign. */
		-webkit-touch-callout: none;
	}

	button:disabled {
		color: var(--faint);
		opacity: 0.5;
	}

	input {
		width: 76px;
		padding: 0;
		border: 0;
		outline: none;
		background: none;
		font-size: 17px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
</style>
