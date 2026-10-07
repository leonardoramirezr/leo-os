<script lang="ts">
	// The first screen: every routine, each with the day to train today, ready to start, and the
	// way to its statistics. A workout under way goes on top, to be picked up again.
	import { pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatAgo, plural, sameDay } from '$lib/format';
	import { dayFor, type Routine } from '$lib/routine';
	import { routines } from '$lib/routines.svelte';
	import { sessions } from '$lib/sessions.svelte';
	import { begin } from '$lib/workout.svelte';
	import Icon from './Icon.svelte';
	import SettingsSheet from './SettingsSheet.svelte';
	import Sheet from './Sheet.svelte';
	import UnderWay from './UnderWay.svelte';

	let settingsOpen = $state(false);
	let creating = $state(false);

	/** A new routine, picked by hand or described in words. */
	function create(state: App.PageState) {
		creating = false;
		pushState('', state);
	}

	const now = Date.now();

	function lastTrained(routine: Routine): number | undefined {
		const done = sessions.of(routine.id).filter((session) => session.sets.length);
		return done.at(-1)?.startedAt;
	}

	/** Whether that day was already trained to the end today. */
	function doneToday(routine: Routine, dayId: string): boolean {
		return sessions
			.of(routine.id)
			.some((session) => session.dayId === dayId && session.finished && sameDay(session.startedAt, now));
	}
</script>

<div class="screen">
	<header class="bar">
		<a class="icon-button" href="{resolve('/')}../" aria-label="Apps" title="Apps" data-sveltekit-reload>
			<Icon name="apps" />
		</a>
		<button
			class="icon-button"
			onclick={() => (settingsOpen = true)}
			aria-label="Ajustes"
			title="Ajustes"
			aria-haspopup="dialog"
		>
			<Icon name="settings" />
		</button>
	</header>

	<h1 class="page-title">Rutina</h1>

	<UnderWay />

	<ul class="routines">
		{#each routines.sorted as routine (routine.id)}
			{@const next = dayFor(routine, sessions.list)}
			{@const last = lastTrained(routine)}
			<li class="routine">
				<button class="head" type="button" onclick={() => pushState('', { routine: routine.id })}>
					<span class="text">
						<span class="name">{routine.name}</span>
						<span class="meta">
							{plural(routine.days.length, 'día', 'días')}
							{#if last}· último entrenamiento {formatAgo(last, now)}{/if}
						</span>
					</span>
					<span class="chevron"><Icon name="forward" size={18} /></span>
				</button>

				{#if next}
					<div class="today">
						<p class="today-label">
							<span class="when">{next.today ? 'Hoy' : 'Sigue'}</span>
							{next.day.name}
							<span class="count">· {plural(next.day.exercises.length, 'ejercicio', 'ejercicios')}</span>
							{#if doneToday(routine, next.day.id)}
								<span class="done"><Icon name="check" size={14} stroke={3} /> hecho</span>
							{/if}
						</p>
						<div class="actions">
							<button
								class="primary"
								type="button"
								disabled={!next.day.exercises.length}
								onclick={() => begin(routine, next.day.id)}
							>
								<Icon name="play" size={16} />
								Empezar
							</button>
							<button
								class="stats"
								type="button"
								onclick={() => pushState('', { routine: routine.id, stats: true })}
								aria-label="Estadísticas de {routine.name}"
							>
								<Icon name="chart" />
								Estadísticas
							</button>
						</div>
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<button class="new" type="button" onclick={() => (creating = true)} aria-haspopup="dialog">
		<Icon name="plus" />
		Nueva rutina
	</button>
</div>

<SettingsSheet bind:open={settingsOpen} />

<Sheet bind:open={creating} title="Nueva rutina">
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (creating = false)}>Cancelar</button>
	{/snippet}

	<ul class="group ways">
		<li>
			<button class="way" type="button" onclick={() => create({ edit: true })}>
				<span class="way-icon"><Icon name="edit" /></span>
				<span class="text">
					<span class="way-name">Manual</span>
					<span class="meta">Elige tú los ejercicios de cada día, con sus series y repeticiones.</span>
				</span>
				<span class="chevron"><Icon name="forward" size={18} /></span>
			</button>
		</li>
		<li>
			<button class="way" type="button" onclick={() => create({ describe: true })}>
				<span class="way-icon"><Icon name="sparkles" /></span>
				<span class="text">
					<span class="way-name">Con texto natural</span>
					<span class="meta">Escríbela o díctala con tus palabras, y la IA la arma con los ejercicios de la app.</span>
				</span>
				<span class="chevron"><Icon name="forward" size={18} /></span>
			</button>
		</li>
	</ul>
</Sheet>

<style>
	.routines {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin: 20px 0 0;
		padding: 0;
		list-style: none;
	}

	.routine {
		overflow: hidden;
		border-radius: 18px;
		background: var(--group);
		box-shadow: var(--shadow);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 16px 14px 10px 18px;
		border: 0;
		background: none;
		text-align: left;
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
	}

	.name {
		font-size: 19px;
		font-weight: 700;
		line-height: 1.25;
	}

	.meta {
		color: var(--muted);
		font-size: 14px;
	}

	.chevron {
		color: var(--faint);
	}

	.today {
		padding: 4px 16px 16px 18px;
	}

	.today-label {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 0 0 12px;
		font-size: 16px;
		font-weight: 600;
	}

	.when {
		padding: 2px 8px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--tint);
		font-size: 13px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.count {
		color: var(--muted);
		font-weight: 400;
	}

	.done {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		color: var(--tint);
		font-size: 14px;
	}

	.actions {
		display: flex;
		gap: 10px;
	}

	.actions .primary {
		flex: 1;
		padding: 12px;
	}

	.stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		flex: 1;
		padding: 12px;
		border: 0;
		border-radius: 14px;
		background: var(--hover);
		color: var(--text);
		font-size: 16px;
		font-weight: 600;
	}

	.ways {
		margin-top: 4px;
	}

	.ways li + li {
		border-top: 1px solid var(--border);
	}

	.way {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-height: 76px;
		padding: 12px 12px 12px 16px;
		border: 0;
		background: none;
		text-align: left;
	}

	.way-icon {
		display: grid;
		place-items: center;
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--tint);
	}

	.way-name {
		font-size: 17px;
		font-weight: 600;
	}

	.new {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		min-height: 56px;
		margin-top: 14px;
		border: 1.5px dashed var(--border);
		border-radius: 18px;
		background: transparent;
		color: var(--tint);
		font-size: 16px;
		font-weight: 600;
	}
</style>
