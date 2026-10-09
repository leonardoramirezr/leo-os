<script lang="ts">
	// The program running, on a screen made to look like a treadmill's: black and white, its numbers
	// in segments, the whole program in bars along the middle. Big enough to be read at a run.
	import { HomeButton } from '@leo-os/shared';
	import { clock, speed } from '$lib/format';
	import { runner, type Run } from '$lib/runner.svelte';
	import { unlock } from '$lib/voice';
	import Digits from './Digits.svelte';
	import Icon from './Icon.svelte';
	import Matrix from './Matrix.svelte';

	let { run }: { run: Run } = $props();

	const segments = $derived(run.program.segments);

	/** A blank first digit, faint as on the display, keeps «8.0» as wide as «10.0». */
	const shown = $derived(
		runner.finished || !runner.segment ? 'FIn' : speed(runner.segment.speed).padStart(4, ' ')
	);

	function toggle() {
		if (runner.paused) runner.resume();
		else runner.pause();
	}

	function exit() {
		if (!runner.finished && !confirm('¿Salir del programa?')) return;

		runner.stop();
		history.back();
	}

	// Space pauses and goes on, Esc leaves: for a keyboard on the treadmill's console.
	function onkeydown(event: KeyboardEvent) {
		if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
		// A focused button answers to Space by itself.
		if (event.target instanceof Element && event.target.closest('button, a')) return;

		if (event.key === ' ' && !runner.finished) {
			event.preventDefault();
			toggle();
		} else if (event.key === 'Escape') {
			exit();
		}
	}
</script>

<svelte:window {onkeydown} />

<!-- Any tap lets the voice speak, should the app have been opened again halfway through a program. -->
<div class="lcd" class:paused={runner.paused} onpointerdown={unlock} role="presentation">
	<header class="head">
		<h1>{run.program.name}</h1>
		{#if runner.finished}
			<span class="badge">Terminado</span>
		{:else if runner.paused}
			<span class="badge">En pausa</span>
		{/if}
		<HomeButton />
	</header>

	<section class="panel speed">
		<div class="labels">
			<h2 class="label">Velocidad</h2>
			{#if !runner.finished}
				<span class="label unit">km/h</span>
			{/if}
		</div>
		<span class="digits">
			<Digits value={shown} label={runner.finished ? 'Fin' : `${shown.trim()} km/h`} />
		</span>
	</section>

	<section class="panel segment">
		<h2 class="label">Segmento {runner.index + 1} de {segments.length}</h2>
		<div class="pair">
			<div class="time">
				<span class="label">Llevas</span>
				<span class="digits"><Digits value={clock(runner.segmentElapsed)} /></span>
			</div>
			<div class="time">
				<span class="label">Falta</span>
				<span class="digits"><Digits value={clock(runner.segmentLeft)} /></span>
			</div>
		</div>
	</section>

	<div class="chart">
		<Matrix {segments} at={runner.elapsed} />
	</div>

	<section class="panel program">
		<h2 class="label">Programa</h2>
		<div class="pair">
			<div class="time">
				<span class="label">Llevas</span>
				<span class="digits"><Digits value={clock(runner.elapsed)} /></span>
			</div>
			<div class="time">
				<span class="label">Falta</span>
				<span class="digits"><Digits value={clock(runner.total - runner.elapsed)} /></span>
			</div>
		</div>
	</section>

	<footer class="keys">
		{#if !runner.finished}
			<button class="key main" onclick={toggle}>
				<Icon name={runner.paused ? 'play' : 'pause'} size={22} />
				{runner.paused ? 'Continuar' : 'Pausa'}
			</button>
		{/if}
		<button class="key" class:main={runner.finished} onclick={exit}>
			<Icon name="close" size={22} stroke={2.6} />
			Salir
		</button>
	</footer>
</div>

<style>
	/* While it shows, the page and the band iOS leaves at the top are the display's paper too. */
	:global(:root:has(.lcd)) {
		--bg: var(--paper);
	}

	.lcd {
		/* How tall each kind of number is: as big as the screen allows, the speed the biggest. The
		   widths bound them too, so that «10.0», or two «00:00» side by side, fit across. */
		--speed: min(17dvh, calc(43vw - 28px), 190px);
		--segment: min(8.5dvh, 12vw, 96px);
		--program: min(6.5dvh, 10vw, 72px);
		--ghost: 0.07;
		--line: 2.5px;

		display: grid;
		grid-template-rows: auto auto auto minmax(90px, 1fr) auto auto;
		grid-template-areas: 'head' 'speed' 'segment' 'chart' 'program' 'keys';
		gap: 12px;
		min-height: 100dvh;
		padding: calc(env(safe-area-inset-top) + 12px) calc(env(safe-area-inset-right) + 16px)
			calc(env(safe-area-inset-bottom) + 16px) calc(env(safe-area-inset-left) + 16px);
		background: var(--paper);
		color: var(--ink);
		/* Tapped at a run: two quick taps must not zoom, nor a long one select the labels. */
		touch-action: manipulation;
		-webkit-user-select: none;
		user-select: none;
	}

	/* Pulled up and out to the corner where the list of programs has the way home, so it stays put. */
	.head {
		display: flex;
		grid-area: head;
		align-items: center;
		gap: 12px;
		min-height: 30px;
		margin: -6px -8px 0 0;
	}

	h1 {
		flex: 1;
		overflow: hidden;
		margin: 0;
		font-size: 17px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}

	/* Printed on the display's frame, as a treadmill's console labels its windows. */
	.label {
		margin: 0;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.12em;
		line-height: 1.2;
		text-transform: uppercase;
	}

	.badge {
		flex: none;
		padding: 4px 9px;
		border-radius: 6px;
		background: var(--ink);
		color: var(--paper);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.panel {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 6px;
		min-width: 0;
		padding: 10px 14px 12px;
		border: var(--line) solid var(--ink);
		border-radius: 14px;
	}

	.digits {
		display: flex;
		justify-content: center;
		min-width: 0;
		line-height: 1;
	}

	.speed {
		grid-area: speed;
	}

	/* The unit goes up with the label, which leaves the number the whole width. */
	.labels {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}

	.unit {
		text-transform: none;
	}

	.speed .digits {
		font-size: var(--speed);
	}

	.segment {
		grid-area: segment;
	}

	.segment .digits {
		font-size: var(--segment);
	}

	.program {
		grid-area: program;
	}

	.program .digits {
		font-size: var(--program);
	}

	.pair {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.time {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.time + .time {
		padding-left: 12px;
		border-left: var(--line) solid var(--ink);
	}

	.time .label {
		opacity: 0.75;
	}

	.chart {
		grid-area: chart;
		min-height: 0;
		padding: 4px 2px 0;
	}

	/* A clock stopped blinks, as the treadmill's does. */
	.paused .pair .digits {
		animation: blink 1.2s steps(1, end) infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0.15;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.paused .pair .digits {
			animation: none;
			opacity: 0.45;
		}
	}

	.keys {
		display: flex;
		grid-area: keys;
		gap: 12px;
	}

	.key {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 10px;
		min-height: 58px;
		padding: 0 12px;
		border: var(--line) solid var(--ink);
		border-radius: 14px;
		background: transparent;
		color: var(--ink);
		font-size: 17px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		transition: transform 0.1s;
	}

	.key.main {
		background: var(--ink);
		color: var(--paper);
	}

	.key:active {
		transform: scale(0.98);
	}

	/* On its side, the program and the keys on the left and the numbers down the right, all of it
	   within the height of a phone lying down. */
	@media (min-aspect-ratio: 5/4) {
		.lcd {
			--speed: min(19dvh, calc(21vw - 26px), 190px);
			--segment: min(12dvh, 6.5vw, 96px);
			--program: min(9.5dvh, 5.5vw, 72px);

			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			/* Room to spare goes to the panels alike; short of it, each keeps what it needs. */
			grid-template-rows: min-content auto auto auto;
			grid-template-areas:
				'head speed'
				'chart speed'
				'chart segment'
				'keys program';
			gap: 10px 20px;
			padding-top: calc(env(safe-area-inset-top) + 10px);
			padding-bottom: calc(env(safe-area-inset-bottom) + 12px);
		}

		.panel {
			padding-top: 8px;
			padding-bottom: 10px;
		}

		.head {
			align-self: start;
		}

		.keys {
			align-self: end;
		}
	}
</style>
