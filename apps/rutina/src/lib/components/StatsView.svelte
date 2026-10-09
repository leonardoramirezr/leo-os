<script lang="ts">
	// How the effort has gone, day by day of the routine: the whole day's and each exercise's, one
	// point per session. «Volumen» — series × repetitions × kilograms — unless «Promedio» is picked,
	// which shows a set's repetitions and its weight on average, each in a chart of its own.
	import { HomeButton, type RutinaDay } from '@leo-os/shared';
	import { formatNumber } from '$lib/format';
	import { dayFor, entryName, type Routine } from '$lib/routine';
	import { sessions } from '$lib/sessions.svelte';
	import { daySeries, entrySeries, type Metric, type Series, type VolumeUnit } from '$lib/stats';
	import ExerciseMedia from './ExerciseMedia.svelte';
	import Icon from './Icon.svelte';
	import LineChart from './LineChart.svelte';

	let { routine }: { routine: Routine } = $props();

	const trained = $derived(sessions.of(routine.id).filter((session) => session.sets.length));

	let metric = $state<Metric>('volume');

	/** The day last trained, which is the one most likely to be looked at; else today's. */
	function initialDay(): string {
		const latest = trained.at(-1);
		if (latest && routine.days.some((day) => day.id === latest.dayId)) return latest.dayId;
		return dayFor(routine, sessions.list)?.day.id ?? routine.days[0]?.id ?? '';
	}

	let dayId = $state(initialDay());
	const day = $derived(routine.days.find((candidate) => candidate.id === dayId) ?? routine.days[0]);

	const VOLUME_TITLES: Record<VolumeUnit, string> = {
		kg: 'Volumen (kg)',
		kgs: 'Volumen (kg × segundos)',
		reps: 'Repeticiones totales (sin peso)',
		s: 'Segundos totales (sin peso)'
	};

	const VOLUME_UNITS: Record<VolumeUnit, string> = { kg: ' kg', kgs: ' kg·s', reps: '', s: ' s' };

	function whole(value: number): string {
		return formatNumber(Math.round(value));
	}

	function charts(series: Series, timed: boolean) {
		if (metric === 'volume') {
			const unit = VOLUME_UNITS[series.unit];
			return [
				{
					title: VOLUME_TITLES[series.unit],
					points: series.volume,
					format: (value: number) => whole(value) + unit,
					zero: true
				}
			];
		}
		const list = [
			{
				title: timed ? 'Segundos por serie, en promedio' : 'Repeticiones por serie, en promedio',
				points: series.reps,
				format: (value: number) => formatNumber(value),
				zero: false
			}
		];
		// With no weight ever, a chart of zeros says nothing.
		if (series.weight.some((point) => point.value > 0)) {
			list.push({
				title: 'Peso por serie, en promedio (kg)',
				points: series.weight,
				format: (value: number) => `${formatNumber(value)} kg`,
				zero: false
			});
		}
		return list;
	}

	function trainedOn(target: RutinaDay): number {
		return trained.filter((session) => session.dayId === target.id).length;
	}
</script>

<div class="screen">
	<header class="bar">
		<button class="back" type="button" onclick={() => history.back()}>
			<Icon name="back" size={24} />
			<span>{routine.name}</span>
		</button>
		<HomeButton />
	</header>

	<h1 class="page-title">Estadísticas</h1>

	<!-- What every chart below shows: one control for all of them, above them. -->
	<div class="controls">
		<div class="segmented" role="radiogroup" aria-label="Qué mostrar">
			<button type="button" role="radio" aria-checked={metric === 'volume'} onclick={() => (metric = 'volume')}>
				Volumen
			</button>
			<button type="button" role="radio" aria-checked={metric === 'average'} onclick={() => (metric = 'average')}>
				Promedio
			</button>
		</div>
		<p class="explain">
			{metric === 'volume'
				? 'Series × repeticiones × peso de cada entrenamiento.'
				: 'Repeticiones y peso de una serie, en promedio, en cada entrenamiento.'}
		</p>

		<div class="days" role="tablist" aria-label="Día">
			{#each routine.days as option (option.id)}
				<button
					type="button"
					role="tab"
					aria-selected={option.id === day?.id}
					onclick={() => (dayId = option.id)}
				>
					{option.name}
					<span class="times">{trainedOn(option)}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if day}
		{@const total = daySeries(trained, day)}
		{#if !total.volume.length}
			<div class="empty">
				<Icon name="chart" size={36} stroke={1.5} />
				<p>Aún no hay entrenamientos de {day.name}. Cada vez que lo entrenes, aquí aparecerá un punto.</p>
			</div>
		{:else}
			<section class="card">
				<h2>{day.name} completo</h2>
				<p class="sub">
					{total.volume.length === 1 ? 'Un entrenamiento' : `${total.volume.length} entrenamientos`}
					{#if day.exercises.some((entry) => entry.timed) && !day.exercises.every((entry) => entry.timed)}
						· sin los ejercicios por tiempo, que van aparte
					{/if}
				</p>
				<div class="charts">
					{#each charts(total, day.exercises.every((entry) => entry.timed)) as chart (chart.title)}
						<LineChart {...chart} />
					{/each}
				</div>
			</section>

			{#each day.exercises as entry (entry.id)}
				{@const series = entrySeries(trained, entry)}
				<section class="card">
					<div class="exercise">
						<ExerciseMedia exercise={entry.exercise} media={entry.media} thumb />
						<h2>{entryName(entry)}</h2>
					</div>
					{#if series.volume.length}
						<div class="charts">
							{#each charts(series, entry.timed) as chart (chart.title)}
								<LineChart {...chart} />
							{/each}
						</div>
					{:else}
						<p class="sub">Sin series registradas aún.</p>
					{/if}
				</section>
			{/each}
		{/if}
	{/if}
</div>

<style>
	.controls {
		position: sticky;
		z-index: 2;
		top: 0;
		margin: 12px -16px 0;
		padding: 8px 16px 12px;
		background: var(--bg);
	}

	.segmented {
		display: flex;
		padding: 2px;
		border-radius: 10px;
		background: var(--hover);
	}

	.segmented button {
		flex: 1;
		padding: 8px;
		border: 0;
		border-radius: 8px;
		background: none;
		font-size: 15px;
	}

	.segmented button[aria-checked='true'] {
		background: var(--group);
		box-shadow: var(--shadow);
		font-weight: 600;
	}

	.explain {
		margin: 8px 4px 12px;
		color: var(--muted);
		font-size: 13px;
	}

	.days {
		display: flex;
		gap: 8px;
		margin: 0 -16px;
		padding: 0 16px;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.days::-webkit-scrollbar {
		display: none;
	}

	.days button {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: none;
		padding: 7px 12px;
		border: 0;
		border-radius: 999px;
		background: var(--group);
		font-size: 15px;
		white-space: nowrap;
	}

	.days button[aria-selected='true'] {
		background: var(--text);
		color: var(--bg);
		font-weight: 600;
	}

	.times {
		min-width: 20px;
		padding: 0 5px;
		border-radius: 999px;
		background: color-mix(in srgb, currentColor 14%, transparent);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.card {
		margin-top: 14px;
		padding: 16px;
		border-radius: 18px;
		background: var(--group);
		box-shadow: var(--shadow);
	}

	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 650;
		line-height: 1.25;
	}

	.sub {
		margin: 2px 0 0;
		color: var(--muted);
		font-size: 14px;
	}

	.exercise {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.charts {
		display: flex;
		flex-direction: column;
		gap: 18px;
		margin-top: 14px;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px 20px;
		color: var(--muted);
		text-align: center;
	}

	.empty p {
		margin: 0;
		max-width: 320px;
		line-height: 1.5;
	}
</style>
