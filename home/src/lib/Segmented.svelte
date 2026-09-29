<script lang="ts" generics="T extends string">
	// An iOS segmented control. Radio buttons underneath, so the arrow keys move between segments.
	let {
		options,
		value = $bindable(),
		label
	}: { options: [value: T, label: string][]; value: T; label: string } = $props();

	const name = $props.id();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
	{#each options as [option, text] (option)}
		<label>
			<input
				type="radio"
				{name}
				value={option}
				checked={value === option}
				onchange={() => (value = option)}
			/>
			<span>{text}</span>
		</label>
	{/each}
</div>

<style>
	/* The colours are the settings sheet's own. */
	.segmented {
		display: grid;
		grid-auto-columns: 1fr;
		grid-auto-flow: column;
		gap: 2px;
		padding: 2px;
		border-radius: 9px;
		background: var(--fill);
	}

	label {
		position: relative;
	}

	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	span {
		display: block;
		padding: 6px 8px;
		border-radius: 7px;
		font-size: 14px;
		font-weight: 500;
		text-align: center;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	input:checked + span {
		background: var(--thumb);
		box-shadow:
			0 3px 8px rgb(0 0 0 / 0.12),
			0 3px 1px rgb(0 0 0 / 0.04);
		font-weight: 600;
	}

	input:focus-visible + span {
		outline: 2px solid var(--link);
		outline-offset: 1px;
	}
</style>
