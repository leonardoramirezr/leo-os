<script lang="ts">
	// The stopwatch: from 00:00:00.00 up to 23:59:59.99, where it stops by itself.
	import { HUNDREDTHS, readout } from '$lib/format';
	import { LIMIT, watch } from '$lib/watch.svelte';
	import Digits from './Digits.svelte';
	import Every from './Every.svelte';
	import Icon from './Icon.svelte';

	const shown = $derived(readout(watch.elapsed / 10));
	const paused = $derived(watch.stopwatch !== null && !watch.stopwatchRunning);
	const full = $derived(watch.elapsed >= LIMIT);
</script>

<section class="panel screen">
	<div class="labels">
		<h2 class="label">Cronómetro</h2>
		{#if full}
			<span class="badge">Máximo</span>
		{:else if paused}
			<span class="badge">En pausa</span>
		{/if}
	</div>
	<div class="face">
		<span class="digits readout" class:blinking={paused && !full}>
			<Digits value={shown} small={HUNDREDTHS} />
		</span>
	</div>
</section>

<Every mode="stopwatch" />

<footer class="keys">
	{#if !watch.stopwatch}
		<button class="key main" onclick={() => watch.startStopwatch()}>
			<Icon name="play" size={22} />
			Iniciar
		</button>
	{:else}
		{#if !full}
			<button
				class="key main"
				onclick={() => (watch.stopwatchRunning ? watch.pauseStopwatch() : watch.resumeStopwatch())}
			>
				<Icon name={watch.stopwatchRunning ? 'pause' : 'play'} size={22} />
				{watch.stopwatchRunning ? 'Pausa' : 'Continuar'}
			</button>
		{/if}
		<button class="key" class:main={full} onclick={() => watch.resetStopwatch()}>
			<Icon name="reset" size={22} stroke={2.6} />
			Reiniciar
		</button>
	{/if}
</footer>
