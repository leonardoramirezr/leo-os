<script lang="ts">
	// The timer: a length picked in hours, minutes and seconds, counted down in hundredths to zero,
	// where the alarm rings.
	import { HUNDREDTHS, readout } from '$lib/format';
	import { duration, validDuration, watch } from '$lib/watch.svelte';
	import Digits from './Digits.svelte';
	import Every from './Every.svelte';
	import Icon from './Icon.svelte';
	import Picker from './Picker.svelte';

	/** What the picker shows: the length last started, until it is changed here. */
	let picked = $state(validDuration(duration.value));

	// Rounded up, so that it shows 00:00:00.00 only once it is over.
	const shown = $derived(readout(Math.ceil(watch.left / 10)));
	const paused = $derived(watch.timer !== null && !watch.timerRunning && !watch.timerDone);
	/** How much of it is left, for the bar under the numbers. */
	const share = $derived(watch.timer ? watch.left / watch.timer.duration : 0);
</script>

{#if !watch.timer}
	<section class="panel screen">
		<h2 class="label">Temporizador</h2>
		<div class="face">
			<Picker bind:value={picked} />
		</div>
	</section>
{:else}
	<section class="panel screen">
		<div class="labels">
			<h2 class="label">Temporizador</h2>
			{#if watch.timerDone}
				<span class="badge">Terminado</span>
			{:else if paused}
				<span class="badge">En pausa</span>
			{/if}
		</div>
		<div class="face">
			<span class="digits readout" class:blinking={paused || watch.ringing}>
				<Digits value={shown} small={HUNDREDTHS} />
			</span>
			<div class="bar" aria-hidden="true">
				<div class="fill" style:width="{(share * 100).toFixed(2)}%"></div>
			</div>
		</div>
	</section>
{/if}

<Every mode="timer" />

<footer class="keys">
	{#if !watch.timer}
		<button class="key main" disabled={!validDuration(picked)} onclick={() => watch.startTimer(picked)}>
			<Icon name="play" size={22} />
			Iniciar
		</button>
	{:else if watch.timerDone}
		<button class="key main" onclick={() => watch.cancelTimer()}>
			<Icon name="close" size={22} stroke={2.6} />
			{watch.ringing ? 'Detener' : 'Listo'}
		</button>
	{:else}
		<button class="key main" onclick={() => (watch.timerRunning ? watch.pauseTimer() : watch.resumeTimer())}>
			<Icon name={watch.timerRunning ? 'pause' : 'play'} size={22} />
			{watch.timerRunning ? 'Pausa' : 'Continuar'}
		</button>
		<button class="key" onclick={() => watch.cancelTimer()}>
			<Icon name="close" size={22} stroke={2.6} />
			Cancelar
		</button>
	{/if}
</footer>

<style>
	/* What is left, as a bar that empties: drawn in ink, its frame always there. */
	.bar {
		height: 14px;
		padding: 2px;
		border: 2px solid var(--ink);
		border-radius: 5px;
	}

	.fill {
		height: 100%;
		border-radius: 2px;
		background: var(--ink);
	}
</style>
