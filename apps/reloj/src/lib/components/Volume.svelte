<script lang="ts">
	// How loud the alarm and the voice are: a slider from silence to three times the phone's own sound,
	// with a notch a third of the way along where the sound is as it always was.
	import { sample } from '$lib/device';
	import { LOUDEST, gain, volume } from '$lib/volume';
	import Icon from './Icon.svelte';

	/** Where the thumb is while it is dragged: the account only gets where it is let go. */
	let dragging = $state<number | null>(null);

	const position = $derived(dragging ?? gain() / LOUDEST);
	const percent = $derived(Math.round(position * LOUDEST * 100));

	function oninput(event: Event) {
		dragging = Number((event.currentTarget as HTMLInputElement).value);
	}

	function onchange(event: Event) {
		volume.value = Number((event.currentTarget as HTMLInputElement).value);
		dragging = null;
		sample();
	}
</script>

<label class="volume" style:--at="{position * 100}%" style:--normal="{100 / LOUDEST}%">
	<Icon name={percent ? 'speak' : 'mute'} size={20} />
	<input
		type="range"
		min="0"
		max="1"
		step="0.01"
		value={position}
		aria-label="Volumen"
		aria-valuetext="{percent} %"
		{oninput}
		{onchange}
	/>
	<span class="amount">{percent}%</span>
</label>

<style>
	.volume {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		margin-left: auto;
	}

	.amount {
		width: 4ch;
		font-size: 12px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	/* A track drawn in ink up to the thumb, faint beyond it, with a notch where the sound is the
	   phone's own. */
	input {
		width: 128px;
		min-width: 0;
		height: 32px;
		margin: 0;
		background: transparent;
		-webkit-appearance: none;
		appearance: none;
		touch-action: pan-x;
	}

	input::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 3px;
		background:
			linear-gradient(var(--ink), var(--ink)) var(--normal) 50% / 2px 12px no-repeat,
			linear-gradient(to right, var(--ink) var(--at), color-mix(in srgb, var(--ink) 20%, transparent) var(--at));
	}

	input::-moz-range-track {
		height: 6px;
		border-radius: 3px;
		background:
			linear-gradient(var(--ink), var(--ink)) var(--normal) 50% / 2px 12px no-repeat,
			linear-gradient(to right, var(--ink) var(--at), color-mix(in srgb, var(--ink) 20%, transparent) var(--at));
	}

	input::-webkit-slider-thumb {
		width: 20px;
		height: 20px;
		margin-top: -7px;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		background: var(--paper);
		-webkit-appearance: none;
		appearance: none;
	}

	input::-moz-range-thumb {
		width: 15px;
		height: 15px;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		background: var(--paper);
	}
</style>
