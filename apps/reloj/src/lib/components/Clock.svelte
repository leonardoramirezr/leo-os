<script lang="ts">
	// The time of day, as the phone writes it, and a key that says it.
	import { day, timeOfDay, twelveHour } from '$lib/format';
	import { minutesOf, watch } from '$lib/watch.svelte';
	import Digits from './Digits.svelte';
	import Every from './Every.svelte';
	import Icon from './Icon.svelte';

	const date = $derived(new Date(watch.now));
	const meridiem = $derived(date.getHours() < 12 ? 'a. m.' : 'p. m.');
</script>

<section class="panel screen">
	<div class="labels">
		<h2 class="label">Hora</h2>
		{#if twelveHour}
			<span class="label">{meridiem}</span>
		{/if}
	</div>
	<div class="face">
		<span class="digits clock">
			<Digits value={timeOfDay(date)} />
		</span>
		<p class="label day">{day(date)}</p>
	</div>
</section>

<Every mode="clock" />

{#if minutesOf('clock')}
	<p class="note">La pantalla se queda encendida para poder decir la hora.</p>
{/if}

<footer class="keys">
	<button class="key main" onclick={() => watch.sayTime()}>
		<Icon name="speak" size={22} />
		Decir la hora
	</button>
</footer>

<style>
	.day {
		text-align: center;
		opacity: 0.75;
	}

	.note {
		margin: -4px 4px 0;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.35;
		opacity: 0.7;
	}
</style>
