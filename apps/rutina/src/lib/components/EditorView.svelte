<script lang="ts">
	// A routine being written or changed: its name, its days, and each day's exercises in the order
	// they are done. Nothing is saved until «Guardar»; the first time the app opens, it opens here. A
	// `draft` is a new routine written by a chat model from a description, to be looked over here.
	import { untrack } from 'svelte';
	import type { RutinaDay, RutinaEntry } from '@leo-os/shared';
	import { pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { blocksText } from '$lib/effort';
	import { formatTimer } from '$lib/format';
	import { entryName, newDay, newEntry, type Routine } from '$lib/routine';
	import { routines } from '$lib/routines.svelte';
	import { sessions } from '$lib/sessions.svelte';
	import EntrySheet from './EntrySheet.svelte';
	import ExerciseMedia from './ExerciseMedia.svelte';
	import ExercisePicker from './ExercisePicker.svelte';
	import Icon from './Icon.svelte';
	import ReviseDock from './ReviseDock.svelte';

	interface Props {
		routine?: Routine;
		first?: boolean;
		draft?: { name: string; days: RutinaDay[] };
		/** In place of «Cancelar»: the way back to what the draft was written from. */
		onback?: () => void;
	}

	let { routine, first = false, draft, onback }: Props = $props();

	function copy(days: RutinaDay[]): RutinaDay[] {
		return structuredClone($state.snapshot(days)) as RutinaDay[];
	}

	// The routine as it was when the editor opened: what is edited is a copy, saved only by «Guardar».
	// (+page draws a new editor for each routine.)
	const initial = untrack(() => {
		const from = routine ?? draft;
		return { name: from?.name ?? '', days: from ? copy(from.days) : [newDay([])] };
	});
	let name = $state(initial.name);
	let days = $state<RutinaDay[]>(initial.days);
	let error = $state('');
	const saved = JSON.stringify(initial);

	/** The exercise in the sheet: of which day, at which place (-1 while it is a new one). */
	let editing = $state<{ day: number; index: number; entry: RutinaEntry } | null>(null);
	let sheetOpen = $state(false);
	let pickerOpen = $state(false);
	let addingTo = 0;

	const dirty = $derived(JSON.stringify({ name, days }) !== saved);

	function add(day: number) {
		addingTo = day;
		pickerOpen = true;
	}

	function picked(id: string, ownName: string) {
		editing = { day: addingTo, index: -1, entry: newEntry(id, ownName) };
		sheetOpen = true;
	}

	function edit(day: number, index: number) {
		editing = { day, index, entry: days[day].exercises[index] };
		sheetOpen = true;
	}

	function saveEntry(entry: RutinaEntry) {
		if (!editing) return;
		const list = days[editing.day].exercises;
		if (editing.index < 0) list.push(entry);
		else list[editing.index] = entry;
		error = '';
	}

	function removeEntry() {
		if (!editing || editing.index < 0) return;
		days[editing.day].exercises.splice(editing.index, 1);
	}

	function moveEntry(direction: -1 | 1) {
		if (!editing || editing.index < 0) return;
		const list = days[editing.day].exercises;
		const to = editing.index + direction;
		if (to < 0 || to >= list.length) return;
		[list[editing.index], list[to]] = [list[to], list[editing.index]];
		editing.index = to;
	}

	function addDay() {
		days.push(newDay(days));
	}

	function moveDay(index: number, direction: -1 | 1) {
		const to = index + direction;
		if (to < 0 || to >= days.length) return;
		[days[index], days[to]] = [days[to], days[index]];
	}

	function removeDay(index: number) {
		const day = days[index];
		const count = day.exercises.length;
		const what = count === 1 ? 'su ejercicio' : `sus ${count} ejercicios`;
		if (count && !confirm(`¿Quitar «${day.name || 'este día'}» con ${what}?`)) return;
		days.splice(index, 1);
	}

	function save() {
		const trimmed = name.trim();
		if (!trimmed) {
			error = 'Ponle nombre a la rutina.';
			return;
		}
		if (!days.some((day) => day.exercises.length)) {
			error = 'Añade al menos un ejercicio a algún día.';
			return;
		}

		const clean = copy(days).map((day, index) => ({ ...day, name: day.name.trim() || `Día ${index + 1}` }));
		if (routine) {
			routines.save(routine.id, trimmed, clean);
			history.back();
			return;
		}

		const created = routines.add(trimmed, clean);
		// The first time there is no list underneath: the new routine goes on top of where the app opened.
		if (first) pushState('', { routine: created.id });
		else replaceState('', { routine: created.id });
	}

	/** The routine on screen, for the AI to change. */
	function current() {
		return { name, days: copy(days) };
	}

	/** A change the AI made, or the routine before it: either way it replaces what is on screen. */
	function revised(routine: { name: string; days: RutinaDay[] }) {
		name = routine.name;
		days = copy(routine.days);
		error = '';
	}

	function cancel() {
		if (dirty && !confirm('¿Descartar los cambios?')) return;
		if (onback) onback();
		else history.back();
	}

	function removeRoutine() {
		if (!routine) return;
		const question = `¿Eliminar «${routine.name}» y todo su historial de entrenamientos? No se puede deshacer.`;
		if (!confirm(question)) return;
		routines.remove(routine.id);
		sessions.forget(routine.id);
		replaceState('', {});
	}

	function summary(entry: RutinaEntry): string {
		const parts = [`${entry.sets} × ${entry.reps}${entry.timed ? ' s' : ''}`];
		if (entry.rest) parts.push(`descanso ${formatTimer(entry.rest)}`);
		if (entry.last.length) parts.push(blocksText(entry.last));
		return parts.join(' · ');
	}
</script>

<div class="screen" class:docked={draft}>
	<header class="bar">
		{#if first}
			<span></span>
		{:else if onback}
			<button class="back" type="button" onclick={cancel}>
				<Icon name="back" size={24} />
				<span>Texto</span>
			</button>
		{:else}
			<button class="text-button" type="button" onclick={cancel}>Cancelar</button>
		{/if}
		<h1 class="bar-title">{routine ? 'Editar rutina' : first ? '' : 'Nueva rutina'}</h1>
		<button class="text-button strong" type="button" onclick={save}>Guardar</button>
	</header>

	{#if first}
		<h2 class="page-title">Rutina</h2>
		<p class="lead">
			Ponle nombre a tu rutina y elige los ejercicios de cada día: cuántas series, de cuánto, y lo último
			que levantaste si ya la venías haciendo.
		</p>
	{:else if draft}
		<p class="lead">
			La armó la IA con lo que describiste. Revísala antes de guardarla: cambia lo que haga falta aquí, o
			pídeselo a la IA con los botones de abajo, escribiendo o hablando. Nada se guarda hasta entonces.
		</p>
	{/if}

	<div class="group name">
		<label class="field">
			<span>Nombre de la rutina</span>
			<input type="text" bind:value={name} placeholder="Full body 5 días" autocomplete="off" />
		</label>
	</div>

	{#if first}
		<!-- The list's «Nueva rutina» offers the same; the first time, there is no list. On top of this
		     screen, so that «back» comes here: saving the routine takes the description's place. -->
		<button class="paste" type="button" onclick={() => pushState('', { describe: true })}>
			<Icon name="sparkles" size={18} />
			¿Prefieres contarla? Descríbela con tus palabras o tu voz
		</button>
	{/if}

	{#if !routine && !draft}
		<!-- In place of this screen rather than on top of it: once the JSON is saved, «back» goes to the
		     list, not to an editor left blank. -->
		<button class="paste" type="button" onclick={() => replaceState('', { edit: page.state.edit, import: true })}>
			<Icon name="code" size={18} />
			¿La tienes escrita en otro lado? Pégala como JSON
		</button>
	{/if}

	{#each days as day, d (day.id)}
		<section class="day">
			<div class="day-head">
				<input
					class="day-name"
					type="text"
					bind:value={day.name}
					placeholder="Nombre del día"
					aria-label="Nombre del día"
					autocomplete="off"
				/>
				<button
					class="icon-button"
					type="button"
					disabled={d === 0}
					onclick={() => moveDay(d, -1)}
					aria-label="Subir día"
				>
					<Icon name="up" size={18} />
				</button>
				<button
					class="icon-button"
					type="button"
					disabled={d === days.length - 1}
					onclick={() => moveDay(d, 1)}
					aria-label="Bajar día"
				>
					<Icon name="down" size={18} />
				</button>
				<button class="icon-button danger" type="button" onclick={() => removeDay(d)} aria-label="Quitar día">
					<Icon name="trash" size={18} />
				</button>
			</div>

			<ul class="group">
				{#each day.exercises as entry, e (entry.id)}
					<li>
						<button class="exercise" type="button" onclick={() => edit(d, e)} aria-haspopup="dialog">
							<ExerciseMedia exercise={entry.exercise} media={entry.media} thumb />
							<span class="text">
								<span class="exercise-name">{entryName(entry)}</span>
								<span class="meta">{summary(entry)}</span>
							</span>
							<span class="chevron"><Icon name="forward" size={18} /></span>
						</button>
					</li>
				{/each}
				<li>
					<button class="add" type="button" onclick={() => add(d)} aria-haspopup="dialog">
						<Icon name="plus" size={18} />
						Añadir ejercicio
					</button>
				</li>
			</ul>
		</section>
	{/each}

	<button class="add-day" type="button" onclick={addDay}>
		<Icon name="plus" />
		Añadir día
	</button>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<button class="primary save" type="button" onclick={save}>Guardar rutina</button>

	{#if routine}
		<button class="destructive" type="button" onclick={removeRoutine}>Eliminar rutina</button>
	{/if}
</div>

<ExercisePicker bind:open={pickerOpen} onpick={picked} />

{#if draft}
	<ReviseDock {current} onrevised={revised} />
{/if}

{#if editing}
	<EntrySheet
		bind:open={sheetOpen}
		entry={editing.entry}
		isNew={editing.index < 0}
		canMoveUp={editing.index > 0}
		canMoveDown={editing.index >= 0 && editing.index < days[editing.day].exercises.length - 1}
		onsave={saveEntry}
		onremove={removeEntry}
		onmove={moveEntry}
	/>
{/if}

<style>
	/* Room under «Guardar rutina» for the buttons that float over the end of the page. */
	.docked {
		padding-bottom: calc(120px + env(safe-area-inset-bottom));
	}

	.lead {
		margin: 4px 4px 20px;
		color: var(--muted);
		line-height: 1.5;
	}

	.name {
		margin-top: 8px;
	}

	.paste {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 12px 4px 0;
		padding: 6px 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 15px;
		text-align: left;
	}

	.paste + .paste {
		margin-top: 2px;
	}

	.day {
		margin-top: 24px;
	}

	.day-head {
		display: flex;
		align-items: center;
		gap: 2px;
		margin: 0 -6px 8px 4px;
	}

	.day-name {
		flex: 1;
		min-width: 0;
		padding: 4px 0;
		border: 0;
		border-bottom: 1.5px solid transparent;
		outline: none;
		background: none;
		font-size: 22px;
		font-weight: 700;
	}

	.day-name:focus {
		border-bottom-color: var(--accent);
	}

	.danger {
		color: var(--danger);
	}

	li + li {
		border-top: 1px solid var(--border);
	}

	.exercise {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 66px;
		padding: 8px 12px 8px 8px;
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

	.exercise-name {
		font-size: 16px;
		font-weight: 500;
		line-height: 1.25;
	}

	.meta {
		overflow: hidden;
		color: var(--muted);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chevron {
		color: var(--faint);
	}

	.add {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 50px;
		padding: 12px 16px;
		border: 0;
		background: none;
		color: var(--tint);
		font-size: 16px;
		font-weight: 600;
	}

	.add-day {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		min-height: 52px;
		margin-top: 20px;
		border: 1.5px dashed var(--border);
		border-radius: 14px;
		background: transparent;
		color: var(--tint);
		font-size: 16px;
		font-weight: 600;
	}

	.save {
		margin-top: 24px;
	}
</style>
