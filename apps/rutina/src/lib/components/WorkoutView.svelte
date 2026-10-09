<script lang="ts">
	// The workout, laid out for a phone lying sideways on a bench: the exercise's animation on one
	// side; on the other its name, the set, the effort expected and the two ways to say the set is
	// done — at that effort, or at another. Then the rest, counting down to the next set.
	//
	// Both have a timer that sounds an alarm when it runs out, until the button that moves on is
	// pressed; the set's falls silent while its effort is being typed. «Terminar» ends it all at
	// any point.
	import { onMount } from 'svelte';
	import { HomeButton, sync, type RutinaBlock } from '@leo-os/shared';
	import {
		keepAwake,
		letSleep,
		preferLandscape,
		releaseOrientation,
		startAlarm,
		stopAlarm,
		unlockSound
	} from '$lib/device';
	import { blockLabel } from '$lib/effort';
	import { formatClock } from '$lib/format';
	import { entryName, expectedBlock, lastSessionWith, roundsOf, setsOf, slotsOf } from '$lib/routine';
	import { sessions } from '$lib/sessions.svelte';
	import { workout } from '$lib/workout.svelte';
	import EffortSheet from './EffortSheet.svelte';
	import ExerciseMedia from './ExerciseMedia.svelte';
	import Icon from './Icon.svelte';
	import SummaryView from './SummaryView.svelte';

	let now = $state(Date.now());
	let effortOpen = $state(false);

	onMount(() => {
		const tick = setInterval(() => (now = Date.now()), 250);
		keepAwake();
		preferLandscape();
		return () => {
			clearInterval(tick);
			stopAlarm();
			letSleep();
			releaseOrientation();
		};
	});

	const session = $derived(workout.session);
	const day = $derived(workout.day);
	const routine = $derived(workout.routine);
	const phase = $derived(workout.phase);
	/** The set under way, or the one the rest leads to. */
	const slot = $derived(workout.slot);

	const previous = $derived.by(() => {
		if (!slot || !session) return [];
		const last = lastSessionWith(sessions.list, slot.entry.id, session.id);
		return last ? setsOf(last, slot.entry.id) : [];
	});
	const expected = $derived(
		slot && session ? expectedBlock(slot.entry, slot.round, session.sets, previous) : undefined
	);

	/** The set the rest follows. */
	const justDone = $derived(phase === 'rest' ? session?.sets.at(-1) : undefined);
	const justDoneEntry = $derived(justDone && day?.exercises.find((entry) => entry.id === justDone.entry));

	const elapsed = $derived(Math.max(0, (now - workout.since) / 1000));
	/** Seconds left of the set's timer; `undefined` when it has none, and the time it has taken shows. */
	const workLeft = $derived(slot && slot.entry.work > 0 ? slot.entry.work - elapsed : undefined);
	const restLeft = $derived(workout.rest - elapsed);

	const rounds = $derived(day ? roundsOf(day) : 0);
	const total = $derived(day ? slotsOf(day).length : 0);
	const done = $derived(session?.sets.length ?? 0);

	const ringing = $derived(
		(phase === 'work' && workLeft !== undefined && workLeft <= 0 && !effortOpen) ||
			(phase === 'rest' && restLeft <= 0)
	);

	$effect(() => {
		if (ringing) startAlarm();
		else stopAlarm();
	});

	/**
	 * A tap that lands right as the screen changes belongs to the screen before: the second tap of a
	 * double tap on «Mismo esfuerzo» would otherwise skip the rest that follows it, as «Empezar
	 * siguiente serie» takes its place.
	 */
	const SETTLE = 600;

	function settled(): boolean {
		return Date.now() - workout.since >= SETTLE;
	}

	function same() {
		if (!expected || !settled()) return;
		unlockSound();
		workout.complete(expected);
	}

	function changeEffort() {
		if (!settled()) return;
		unlockSound();
		effortOpen = true;
	}

	function saveEffort(block: RutinaBlock) {
		workout.complete(block);
	}

	function startSet() {
		if (!settled()) return;
		unlockSound();
		workout.startSet();
	}

	function end() {
		unlockSound();
		if (confirm('¿Terminar el entrenamiento? Lo que llevas hecho se guarda.')) workout.end();
	}

	function close() {
		workout.close();
		history.back();
	}

	// Space or Enter is «Mismo esfuerzo», or starts the next set during the rest: handy with a
	// keyboard, and with the volume buttons of a remote that sends them.
	function onkeydown(event: KeyboardEvent) {
		if (effortOpen || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('input, textarea, select, button, a')) return;
		if (event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		if (phase === 'work') same();
		else if (phase === 'rest') startSet();
	}
</script>

<svelte:window {onkeydown} />

{#if !session || !day || !routine}
	<header class="bar gone-bar">
		<HomeButton />
	</header>
	<div class="gone">
		<p>Este entrenamiento ya no está: su rutina o su día se borraron.</p>
		<button class="primary" type="button" onclick={close}>Volver</button>
	</div>
{:else if phase === 'done'}
	<SummaryView {session} {day} {routine} onclose={close} />
{:else}
	<!-- With no signal, `Account`'s banner says so along the top edge: the workout steps down from it
	     rather than have «Terminar» under it. The sets wait on the phone meanwhile (`sessions`). -->
	<div class="workout" class:rest={phase === 'rest'} class:ringing class:offline={Boolean(sync.error)}>
		<header class="top">
			<button class="end" type="button" onclick={end}>
				<Icon name="close" size={18} stroke={2.5} />
				Terminar
			</button>
			<p class="where">
				<span class="day">{day.name}</span>
				<span class="round">Ronda {slot?.round ?? rounds} de {rounds}</span>
			</p>
			<div
				class="progress"
				role="progressbar"
				aria-label="Series hechas"
				aria-valuemin={0}
				aria-valuemax={total}
				aria-valuenow={done}
			>
				<span style:width="{total ? (done / total) * 100 : 0}%"></span>
			</div>
			<span class="count">{done}/{total}</span>
			<HomeButton />
		</header>

		<!-- Portrait still works — a phone with the rotation locked cannot turn the page — but sideways
		     is what it is laid out for. -->
		<p class="turn"><Icon name="rotate" size={16} /> Gira el teléfono para verlo en horizontal</p>

		{#if phase === 'work' && slot && expected}
			<main class="stage">
				<div class="picture">
					<ExerciseMedia exercise={slot.entry.exercise} media={slot.entry.media} />
				</div>

				<section class="panel">
					<h1 class="exercise">{entryName(slot.entry)}</h1>
					<p class="set">Serie {slot.round} de {slot.entry.sets}</p>

					<p class="effort" aria-label="Esfuerzo esperado">{blockLabel(expected, slot.entry.timed)}</p>

					<p class="timer" class:over={workLeft !== undefined && workLeft <= 0}>
						<Icon name="timer" size={20} />
						{#if workLeft !== undefined}
							{formatClock(workLeft)}
						{:else}
							{formatClock(-elapsed).replace('+', '')}
						{/if}
					</p>

					<div class="buttons">
						<button class="primary same" type="button" onclick={same}>
							<Icon name="check" size={20} stroke={2.75} />
							Mismo esfuerzo
						</button>
						<button class="other" type="button" onclick={changeEffort} aria-haspopup="dialog">
							Cambiar esfuerzo
						</button>
					</div>
				</section>
			</main>

			<EffortSheet bind:open={effortOpen} {expected} timed={slot.entry.timed} onsave={saveEffort} />
		{:else if phase === 'rest' && slot && expected}
			<main class="stage">
				<section class="clock">
					<p class="label">Descanso</p>
					<p class="left" class:over={restLeft <= 0}>{formatClock(restLeft)}</p>
					{#if justDone && justDoneEntry}
						<p class="did">
							<Icon name="check" size={16} stroke={2.75} />
							{entryName(justDoneEntry)}: {blockLabel(justDone, justDoneEntry.timed)}
						</p>
					{/if}
				</section>

				<section class="panel next">
					<p class="label">Sigue</p>
					<div class="next-row">
						<div class="next-picture">
							<ExerciseMedia exercise={slot.entry.exercise} media={slot.entry.media} />
						</div>
						<div>
							<h1 class="exercise small">{entryName(slot.entry)}</h1>
							<p class="set">Serie {slot.round} de {slot.entry.sets} · {blockLabel(expected, slot.entry.timed)}</p>
						</div>
					</div>
					<button class="primary go" type="button" onclick={startSet}>
						<Icon name="play" size={18} />
						Empezar siguiente serie
					</button>
				</section>
			</main>
		{/if}
	</div>
{/if}

<style>
	.workout {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		padding: calc(env(safe-area-inset-top) + 8px) calc(env(safe-area-inset-right) + 16px)
			calc(env(safe-area-inset-bottom) + 12px) calc(env(safe-area-inset-left) + 16px);
		background: var(--bg);
		transition: background-color 0.3s;
	}

	.workout.offline {
		padding-top: calc(env(safe-area-inset-top) + 64px);
	}

	/* The rest takes the whole screen in its own colour: seen from across the room, it says «wait». */
	.workout.rest {
		background: var(--rest);
		color: #fff;
		--muted: rgb(255 255 255 / 0.8);
	}

	/* The alarm shows as well as sounds — an iPhone on silent plays no sound —: the screen turns red
	   and the time blinks. */
	.workout.ringing {
		background: var(--alarm);
		color: #fff;
		--muted: rgb(255 255 255 / 0.85);
	}

	.ringing .timer,
	.ringing .left {
		animation: blink 1s steps(1) infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0.25;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ringing .timer,
		.ringing .left {
			animation: none;
		}
	}

	/* Out to the corner where every other screen has the way home, so it stays put. */
	.top {
		display: flex;
		flex: none;
		align-items: center;
		gap: 12px;
		min-height: 40px;
		margin: -2px -8px 0 0;
	}

	.end {
		display: flex;
		align-items: center;
		gap: 4px;
		flex: none;
		padding: 7px 12px 7px 9px;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, currentColor 12%, transparent);
		color: inherit;
		font-size: 15px;
		font-weight: 600;
	}

	.where {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		margin: 0;
		white-space: nowrap;
	}

	.day {
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
	}

	.round {
		color: var(--muted);
		font-size: 15px;
	}

	.progress {
		flex: 1;
		min-width: 40px;
		height: 6px;
		overflow: hidden;
		border-radius: 3px;
		background: color-mix(in srgb, currentColor 14%, transparent);
	}

	.progress span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
		transition: width 0.35s ease;
	}

	.rest .progress span,
	.ringing .progress span {
		background: #fff;
	}

	.count {
		flex: none;
		color: var(--muted);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.turn {
		display: none;
	}

	.stage {
		display: grid;
		flex: 1;
		min-height: 0;
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		align-items: center;
		gap: 24px;
		padding-top: 12px;
	}

	.picture {
		height: 100%;
		max-height: 100%;
		min-height: 0;
		overflow: hidden;
		border-radius: 20px;
	}

	.panel {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 0;
		max-height: 100%;
		overflow-y: auto;
	}

	.panel p,
	.clock p {
		margin: 0;
	}

	/* Two lines at most: a long name must not push the buttons off a phone lying sideways. */
	.exercise {
		display: -webkit-box;
		margin: 0;
		overflow: hidden;
		font-size: clamp(20px, 3.6vw, 30px);
		font-weight: 700;
		line-height: 1.15;
		letter-spacing: -0.01em;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.exercise.small {
		font-size: 19px;
	}

	.set {
		margin-top: 4px !important;
		color: var(--muted);
		font-size: 16px;
	}

	.effort {
		margin-top: 10px !important;
		font-size: clamp(34px, 7vw, 56px);
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.05;
	}

	.timer {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px !important;
		color: var(--muted);
		font-size: 22px;
		font-variant-numeric: tabular-nums;
	}

	.timer.over {
		color: var(--alarm);
		font-weight: 700;
	}

	.ringing .timer.over {
		color: #fff;
	}

	.buttons {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 18px;
	}

	.same {
		padding: 16px;
		font-size: 19px;
	}

	.ringing .same {
		background: #fff;
		color: var(--alarm);
	}

	.other {
		padding: 13px;
		border: 0;
		border-radius: 14px;
		background: color-mix(in srgb, currentColor 10%, transparent);
		color: inherit;
		font-size: 17px;
		font-weight: 600;
	}

	.clock {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.label {
		color: var(--muted);
		font-size: 15px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.left {
		font-size: clamp(72px, 16vw, 132px);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.03em;
		line-height: 1;
	}

	.did {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 12px !important;
		color: var(--muted);
		font-size: 15px;
	}

	.next-row {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-top: 8px;
	}

	.next-picture {
		width: 96px;
		height: 96px;
		flex: none;
		overflow: hidden;
		border-radius: 14px;
	}

	.go {
		margin-top: 18px;
		padding: 16px;
		background: #fff;
		color: var(--rest);
		font-size: 18px;
	}

	.ringing .go {
		color: var(--alarm);
	}

	.gone-bar {
		justify-content: flex-end;
		max-width: 560px;
		margin: 0 auto;
		padding-right: 8px;
	}

	.gone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		max-width: 360px;
		margin: 0 auto;
		padding: 64px 20px;
		text-align: center;
	}

	/* A phone lying sideways is short: an iPhone SE has 375 points from edge to edge. */
	@media (orientation: landscape) and (max-height: 430px) {
		.top {
			min-height: 34px;
		}

		.stage {
			gap: 18px;
			padding-top: 8px;
		}

		.exercise {
			font-size: clamp(18px, 6vh, 26px);
		}

		.set {
			font-size: 15px;
		}

		.effort {
			margin-top: 4px !important;
			font-size: clamp(30px, 11vh, 46px);
		}

		.timer {
			margin-top: 2px !important;
			font-size: 18px;
		}

		.buttons {
			gap: 8px;
			margin-top: 10px;
		}

		.same {
			padding: 12px;
			font-size: 17px;
		}

		.other {
			padding: 10px;
			font-size: 16px;
		}

		.left {
			font-size: clamp(64px, 26vh, 120px);
		}

		.next-picture {
			width: 72px;
			height: 72px;
		}

		.go {
			margin-top: 12px;
			padding: 13px;
		}
	}

	/* Upright: the animation above, the rest below, and a word about turning the phone. */
	@media (orientation: portrait) {
		.turn {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			margin: 8px 0 0;
			color: var(--muted);
			font-size: 13px;
		}

		.stage {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) auto;
			align-items: stretch;
			gap: 16px;
		}

		/* Whatever height is left over above the controls: the animation shows whole in it, centred. */
		.picture {
			width: 100%;
			height: 100%;
		}

		.clock {
			padding: 24px 0;
		}
	}
</style>
