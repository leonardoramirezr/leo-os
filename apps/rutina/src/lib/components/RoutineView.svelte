<script lang="ts">
	// One routine: every day with its exercises and where each one stands — the first block of work
	// the app knows of and the last —, ready to start any of them.
	import { HomeButton, type RutinaEntry } from '@leo-os/shared';
	import { pushState } from '$app/navigation';
	import { blocksText } from '$lib/effort';
	import { formatAgo, plural } from '$lib/format';
	import { dayFor, entryName, firstBlocks, lastBlocks, type Routine } from '$lib/routine';
	import { sessions } from '$lib/sessions.svelte';
	import { begin } from '$lib/workout.svelte';
	import ExerciseMedia from './ExerciseMedia.svelte';
	import Icon from './Icon.svelte';
	import UnderWay from './UnderWay.svelte';

	let { routine }: { routine: Routine } = $props();

	/** The sessions that got as far as a set: the history the blocks and the dates come from. */
	const trained = $derived(sessions.of(routine.id).filter((session) => session.sets.length));
	const next = $derived(dayFor(routine, sessions.list));

	function lastOf(dayId: string): number | undefined {
		return trained.filter((session) => session.dayId === dayId).at(-1)?.startedAt;
	}

	/** The first block and the last, written as the routine it came from wrote them: «15,15@72kg». */
	function progress(entry: RutinaEntry): { first: string; last: string } {
		const first = blocksText(firstBlocks(entry, trained));
		const last = blocksText(lastBlocks(entry, trained));
		return { first, last };
	}
</script>

<div class="screen">
	<header class="bar">
		<button class="back" type="button" onclick={() => history.back()}>
			<Icon name="back" size={24} />
			<span>Rutinas</span>
		</button>
		<div class="bar-end">
			<button class="text-button" type="button" onclick={() => pushState('', { routine: routine.id, edit: true })}>
				Editar
			</button>
			<HomeButton />
		</div>
	</header>

	<h1 class="page-title">{routine.name}</h1>
	<p class="caption">
		{plural(routine.days.length, 'día', 'días')} · {trained.length
			? plural(trained.length, 'entrenamiento', 'entrenamientos')
			: 'sin entrenamientos aún'}
	</p>

	<UnderWay />

	<button class="stats" type="button" onclick={() => pushState('', { routine: routine.id, stats: true })}>
		<Icon name="chart" />
		Estadísticas
	</button>

	{#each routine.days as day (day.id)}
		{@const last = lastOf(day.id)}
		<section class="day">
			<div class="day-head">
				<div class="day-title">
					<h2>
						{day.name}
						{#if next?.day.id === day.id}<span class="when">{next.today ? 'Hoy' : 'Sigue'}</span>{/if}
					</h2>
					<p class="meta">{last ? `Último: ${formatAgo(last)}` : 'Sin entrenar aún'}</p>
				</div>
				<button
					class="start"
					type="button"
					disabled={!day.exercises.length}
					onclick={() => begin(routine, day.id)}
				>
					<Icon name="play" size={14} />
					Empezar
				</button>
			</div>

			{#if day.exercises.length}
				<ul class="group">
					{#each day.exercises as entry (entry.id)}
						{@const blocks = progress(entry)}
						<li class="exercise">
							<ExerciseMedia exercise={entry.exercise} media={entry.media} thumb />
							<div class="text">
								<p class="exercise-name">{entryName(entry)}</p>
								<p class="plan">
									{entry.sets} × {entry.reps}{entry.timed ? ' s' : ''}
								</p>
								{#if blocks.last}
									<p class="blocks">
										{#if blocks.first && blocks.first !== blocks.last}
											<span class="label">Primero</span> {blocks.first}
											<span class="arrow">→</span>
										{/if}
										<span class="label">Último</span> <strong>{blocks.last}</strong>
									</p>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty">Este día aún no tiene ejercicios. Agrégalos en «Editar».</p>
			{/if}
		</section>
	{/each}
</div>

<style>
	.caption {
		margin: 2px 4px 16px;
		color: var(--muted);
		font-size: 15px;
	}

	.stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		margin-top: 12px;
		padding: 13px;
		border: 0;
		border-radius: 14px;
		background: var(--group);
		box-shadow: var(--shadow);
		font-size: 16px;
		font-weight: 600;
	}

	.day {
		margin-top: 26px;
	}

	.day-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 0 0 10px 4px;
	}

	.day-title {
		flex: 1;
		min-width: 0;
	}

	h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 22px;
		font-weight: 700;
	}

	.when {
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--tint);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
	}

	.meta {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 14px;
	}

	.start {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
		padding: 9px 14px;
		border: 0;
		border-radius: 999px;
		background: var(--accent);
		color: #fff;
		font-size: 15px;
		font-weight: 600;
	}

	.start:disabled {
		opacity: 0.4;
	}

	.exercise {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px 10px 8px;
	}

	.exercise + .exercise {
		border-top: 1px solid var(--border);
	}

	.text {
		flex: 1;
		min-width: 0;
	}

	.text p {
		margin: 0;
	}

	.exercise-name {
		font-size: 16px;
		font-weight: 500;
		line-height: 1.25;
	}

	.plan {
		margin-top: 2px !important;
		color: var(--muted);
		font-size: 14px;
	}

	.blocks {
		margin-top: 3px !important;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
		line-height: 1.4;
	}

	.label {
		color: var(--muted);
		font-size: 12px;
	}

	.arrow {
		margin: 0 2px;
		color: var(--faint);
	}

	.empty {
		margin: 0 4px;
		color: var(--muted);
		font-size: 15px;
	}
</style>
