<script lang="ts">
	// The three of them on one display, black and white with its numbers in segments, as Caminadora's
	// running program is, and a key along the bottom for each.
	import { HomeButton } from '@leo-os/shared';
	import { unlockSound } from '$lib/device';
	import { unlock } from '$lib/voice';
	import { tab, watch, type Mode } from '$lib/watch.svelte';
	import Clock from '$lib/components/Clock.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import Stopwatch from '$lib/components/Stopwatch.svelte';
	import Timer from '$lib/components/Timer.svelte';

	const TABS: { mode: Mode; name: string; icon: IconName }[] = [
		{ mode: 'stopwatch', name: 'Cronómetro', icon: 'stopwatch' },
		{ mode: 'timer', name: 'Temporizador', icon: 'timer' },
		{ mode: 'clock', name: 'Hora', icon: 'clock' }
	];

	const mode = $derived(TABS.some((entry) => entry.mode === tab.value) ? tab.value : 'stopwatch');

	/** Whether one that is not showing is under way, which its key marks. */
	function going(of: Mode): boolean {
		if (of === 'stopwatch') return watch.stopwatchRunning;
		if (of === 'timer') return watch.timerRunning || watch.ringing;
		return false;
	}

	// The alarm brings the timer up, wherever the app was.
	$effect(() => {
		if (watch.ringing) tab.value = 'timer';
	});

	$effect(() => watch.hold(watch.busy));

	/** Every tap lets the voice speak and the alarm sound later on, which iOS only allows from one. */
	function onpointerdown() {
		unlock();
		unlockSound();
	}

	// Space starts, pauses and goes on, for a keyboard; a focused button answers to it by itself.
	function onkeydown(event: KeyboardEvent) {
		if (event.key !== ' ' || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
		if (event.target instanceof Element && event.target.closest('button, a, input')) return;

		event.preventDefault();
		onpointerdown();
		if (mode === 'stopwatch') {
			if (!watch.stopwatch) watch.startStopwatch();
			else if (watch.stopwatchRunning) watch.pauseStopwatch();
			else watch.resumeStopwatch();
		} else if (mode === 'timer' && watch.timer) {
			if (watch.timerDone) watch.cancelTimer();
			else if (watch.timerRunning) watch.pauseTimer();
			else watch.resumeTimer();
		} else if (mode === 'clock') {
			watch.sayTime();
		}
	}
</script>

<svelte:window {onkeydown} />

<div class="lcd" {onpointerdown} role="presentation">
	<header class="head">
		<h1>Reloj</h1>
	</header>

	<div class="corner">
		<HomeButton />
	</div>

	<main class="body">
		{#if mode === 'stopwatch'}
			<Stopwatch />
		{:else if mode === 'timer'}
			<Timer />
		{:else}
			<Clock />
		{/if}
	</main>

	<nav class="tabs" aria-label="Funciones">
		{#each TABS as entry (entry.mode)}
			<button
				class="tab"
				class:on={mode === entry.mode}
				aria-current={mode === entry.mode ? 'page' : undefined}
				onclick={() => (tab.value = entry.mode)}
			>
				<span class="glyph">
					<Icon name={entry.icon} size={22} />
					{#if going(entry.mode) && mode !== entry.mode}
						<span class="dot" aria-label="en curso"></span>
					{/if}
				</span>
				{entry.name}
			</button>
		{/each}
	</nav>
</div>

<style>
	.lcd {
		/* How tall each kind of number is: as big as the screen allows, within its width. The ratios
		   are how wide each reading is to its height: «00:00:00.00» with small hundredths, «00:00:00»,
		   and one column of the timer's picker. */
		--room: calc(min(100vw, 560px) - 64px);
		--readout: min(calc(var(--room) / 5.6), 20dvh, 120px);
		--clock: min(calc(var(--room) / 4.7), 22dvh, 140px);
		--pick: min(calc((var(--room) - 40px) / 4.2), 12dvh, 88px);

		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto 1fr auto;
		grid-template-areas: 'head home' 'body body' 'tabs tabs';
		gap: 12px;
		max-width: 560px;
		min-height: 100dvh;
		margin: 0 auto;
		padding: calc(env(safe-area-inset-top) + 8px) calc(env(safe-area-inset-right) + 16px)
			calc(env(safe-area-inset-bottom) + 12px) calc(env(safe-area-inset-left) + 16px);
		background: var(--paper);
		color: var(--ink);
		/* Tapped in a hurry: two quick taps must not zoom, nor a long one select the labels. */
		touch-action: manipulation;
		-webkit-user-select: none;
		user-select: none;
	}

	.head {
		display: flex;
		grid-area: head;
		align-items: center;
		min-height: 40px;
	}

	/* Pulled up and out to the corner where every other app has the way home, so it stays put. */
	.corner {
		display: flex;
		grid-area: home;
		margin: -2px -8px 0 0;
	}

	h1 {
		margin: 0;
		font-size: 17px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.body {
		display: flex;
		grid-area: body;
		flex-direction: column;
		gap: 12px;
		min-height: 0;
	}

	/* The window with the numbers takes whatever room is left. */
	.body :global(.screen) {
		flex: 1;
		justify-content: flex-start;
	}

	.body :global(.readout) {
		font-size: var(--readout);
	}

	.body :global(.clock) {
		font-size: var(--clock);
	}

	.tabs {
		display: grid;
		grid-area: tabs;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		padding-top: 12px;
		border-top: var(--line) solid var(--ink);
	}

	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		min-width: 0;
		padding: 8px 2px;
		border: 0;
		border-radius: 12px;
		background: transparent;
		color: var(--ink);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		opacity: 0.55;
	}

	.tab.on {
		background: var(--ink);
		color: var(--paper);
		opacity: 1;
	}

	.glyph {
		position: relative;
	}

	.dot {
		position: absolute;
		top: -2px;
		right: -6px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: currentColor;
	}

	/* On its side, the numbers on the left and the rest on the right, the tabs up beside the title:
	   all of it within the height of a phone lying down. */
	@media (min-aspect-ratio: 5/4) {
		.lcd {
			--room: calc((min(100vw, 960px) - 64px) * 0.55);
			--readout: min(calc(var(--room) / 5.6), 26dvh, 120px);
			--clock: min(calc(var(--room) / 4.7), 30dvh, 140px);
			--pick: min(calc((var(--room) - 40px) / 4.2), 17dvh, 88px);

			grid-template-columns: auto 1fr auto;
			grid-template-rows: auto 1fr;
			grid-template-areas: 'head tabs home' 'body body body';
			gap: 10px 20px;
			max-width: 960px;
		}

		/* The keys at the foot of the right side, whatever goes above them. */
		.body {
			display: grid;
			grid-template-columns: 55fr 45fr;
			grid-template-rows: auto auto 1fr;
			gap: 10px 16px;
		}

		.body :global(.screen) {
			grid-column: 1;
			grid-row: 1 / -1;
		}

		.body > :global(:not(.screen)) {
			grid-column: 2;
		}

		.body :global(.keys) {
			grid-row: -2;
			align-self: end;
		}

		.body :global(.key) {
			min-height: 50px;
		}

		.tabs {
			padding-top: 0;
			border-top: 0;
		}

		.tab {
			flex-direction: row;
			justify-content: center;
			gap: 8px;
			padding: 8px 6px;
		}
	}
</style>
