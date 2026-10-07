<script lang="ts">
	// One exercise of a day: which one, how many sets of how much, the rest after each set, the set's
	// own timer, and the last block done before the app kept track. Changes are made on a copy and
	// only reach the day with «Listo».
	import { untrack } from 'svelte';
	import type { RutinaEntry } from '@leo-os/shared';
	import { exerciseOf, groupOf } from '$lib/catalog';
	import { blockLabel, blocksText, parseBlocks } from '$lib/effort';
	import { formatTimer, parseSeconds } from '$lib/format';
	import { entryName, LIMITS } from '$lib/routine';
	import ExerciseMedia from './ExerciseMedia.svelte';
	import ExercisePicker from './ExercisePicker.svelte';
	import Sheet from './Sheet.svelte';
	import Stepper from './Stepper.svelte';

	let {
		open = $bindable(),
		entry,
		isNew = false,
		canMoveUp = false,
		canMoveDown = false,
		onsave,
		onremove,
		onmove
	}: {
		open: boolean;
		entry: RutinaEntry;
		/** Just picked: «Cancelar» leaves it out of the day. */
		isNew?: boolean;
		canMoveUp?: boolean;
		canMoveDown?: boolean;
		onsave: (entry: RutinaEntry) => void;
		onremove: () => void;
		onmove: (direction: -1 | 1) => void;
	} = $props();

	function copy(): RutinaEntry {
		return structuredClone($state.snapshot(entry)) as RutinaEntry;
	}

	// A copy to edit: `entry` changes only by «Listo», and the effect below copies it again on opening.
	let draft = $state<RutinaEntry>(untrack(copy));
	let lastText = $state('');
	let picking = $state(false);

	// Every time it opens, it starts from the exercise as the day has it.
	$effect(() => {
		if (!open) return;
		// From the copy itself: reading `draft` back here would make the effect run on its own writes.
		const fresh = copy();
		draft = fresh;
		lastText = blocksText(fresh.last);
	});

	const catalog = $derived(exerciseOf(draft.exercise));
	const parsed = $derived(lastText.trim() ? parseBlocks(lastText) : []);
	const unit = $derived(draft.timed ? 'Segundos' : 'Repeticiones');

	function done() {
		if (!parsed) return;
		onsave({ ...$state.snapshot(draft), name: draft.name.trim(), media: draft.media.trim(), last: parsed });
		open = false;
	}

	function change(id: string, name: string) {
		draft.exercise = id;
		draft.name = name;
		const timed = Boolean(exerciseOf(id)?.timed);
		if (id && timed !== draft.timed) draft.timed = timed;
	}

	function remove() {
		open = false;
		onremove();
	}
</script>

<Sheet bind:open title={isNew ? 'Nuevo ejercicio' : 'Ejercicio'}>
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}
	{#snippet trailing()}
		<button class="text-button strong" type="button" onclick={done} disabled={!parsed}>Listo</button>
	{/snippet}

	<div class="exercise">
		<div class="picture"><ExerciseMedia exercise={draft.exercise} media={draft.media} /></div>
		<div class="what">
			<p class="title">{entryName(draft)}</p>
			<p class="meta">
				{#if catalog}
					<span class="dot" style:background="var(--group-{catalog.group})"></span>
					{groupOf(catalog.group)}
					{#if draft.name.trim() && draft.name.trim() !== catalog.name}· {catalog.name}{/if}
				{:else}
					Ejercicio propio
				{/if}
			</p>
			<button class="change" type="button" onclick={() => (picking = true)} aria-haspopup="dialog">
				Cambiar ejercicio
			</button>
		</div>
	</div>

	<div class="group">
		<label class="field">
			<span>Nombre</span>
			<input
				type="text"
				bind:value={draft.name}
				placeholder={catalog?.name ?? 'Nombre del ejercicio'}
				autocomplete="off"
			/>
		</label>
	</div>
	<p class="hint">El nombre que ves al entrenar. Vacío, el de la animación.</p>

	<h3 class="section-title">Series</h3>
	<div class="group">
		<div class="field inline">
			<span>Series</span>
			<Stepper bind:value={draft.sets} min={1} max={LIMITS.sets} label="Series" />
		</div>
		<div class="field inline">
			<span>Se mide en</span>
			<div class="segmented" role="radiogroup" aria-label="Se mide en">
				<button type="button" role="radio" aria-checked={!draft.timed} onclick={() => (draft.timed = false)}>
					Repeticiones
				</button>
				<button type="button" role="radio" aria-checked={draft.timed} onclick={() => (draft.timed = true)}>
					Segundos
				</button>
			</div>
		</div>
		<div class="field inline">
			<span>{unit}</span>
			<Stepper bind:value={draft.reps} min={1} max={LIMITS.reps} step={draft.timed ? 5 : 1} label={unit} />
		</div>
	</div>

	<h3 class="section-title">Temporizadores</h3>
	<div class="group">
		<div class="field inline">
			<span>Por serie</span>
			<Stepper
				bind:value={draft.work}
				min={0}
				max={LIMITS.seconds}
				step={15}
				label="Tiempo por serie"
				format={formatTimer}
				parse={parseSeconds}
			/>
		</div>
		<div class="field inline">
			<span>Descanso</span>
			<Stepper
				bind:value={draft.rest}
				min={0}
				max={LIMITS.seconds}
				step={15}
				label="Descanso"
				format={formatTimer}
				parse={parseSeconds}
			/>
		</div>
	</div>
	<p class="hint">
		Cada serie tiene su tiempo: al llegar a 0 suena la alarma hasta que la marques como hecha. Después de
		cada serie viene el descanso, que también suena al acabar. «Sin» quita el temporizador.
	</p>

	<h3 class="section-title">Último bloque de trabajo</h3>
	<div class="group">
		<label class="field">
			<span>Opcional: lo último que hiciste fuera de la app</span>
			<input
				type="text"
				bind:value={lastText}
				placeholder={draft.timed ? '60@10kg' : '15@72kg'}
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
			/>
		</label>
	</div>
	{#if !parsed}
		<p class="error">
			No se entiende. Se escribe como repeticiones@peso: «15@72kg», o «15,15,12@72kg» para tres series.
		</p>
	{:else if parsed.length}
		<p class="hint">
			{parsed.length === 1 ? 'Una serie' : `${parsed.length} series`}:
			{parsed.map((block) => blockLabel(block, draft.timed)).join(' · ')}. Es el esfuerzo que la app espera
			la primera vez; después, el de tu último entrenamiento.
		</p>
	{:else}
		<p class="hint">
			«15@72kg» son 15 repeticiones con 72 kg. Sin él, la app espera {draft.reps}
			{draft.timed ? 'segundos' : 'repeticiones'} sin peso hasta que registres otro esfuerzo.
		</p>
	{/if}

	<h3 class="section-title">Animación</h3>
	<div class="group">
		<label class="field">
			<span>Opcional: un GIF o un video (MP4) propio</span>
			<input
				type="url"
				bind:value={draft.media}
				placeholder="https://…/ejercicio.gif"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
			/>
		</label>
	</div>
	<p class="hint">La dirección directa del archivo. Se muestra en lugar de la animación de la app.</p>

	{#if !isNew && (canMoveUp || canMoveDown)}
		<div class="moves">
			<button class="secondary" type="button" disabled={!canMoveUp} onclick={() => onmove(-1)}>Antes</button>
			<button class="secondary" type="button" disabled={!canMoveDown} onclick={() => onmove(1)}>Después</button>
		</div>
	{/if}

	{#if !isNew}
		<button class="destructive" type="button" onclick={remove}>Quitar del día</button>
	{/if}
</Sheet>

<ExercisePicker bind:open={picking} title="Cambiar ejercicio" onpick={change} />

<style>
	.exercise {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 16px;
	}

	.picture {
		width: 96px;
		height: 96px;
		flex: none;
		overflow: hidden;
		border-radius: 16px;
	}

	.what {
		min-width: 0;
	}

	.title {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		line-height: 1.25;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 4px 0 0;
		color: var(--muted);
		font-size: 14px;
	}

	.change {
		margin-top: 6px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 15px;
	}

	.segmented {
		display: flex;
		padding: 2px;
		border-radius: 9px;
		background: var(--hover);
	}

	.segmented button {
		padding: 6px 10px;
		border: 0;
		border-radius: 7px;
		background: none;
		font-size: 14px;
	}

	.segmented button[aria-checked='true'] {
		background: var(--group);
		box-shadow: var(--shadow);
		font-weight: 600;
	}

	.moves {
		display: flex;
		gap: 10px;
		margin-top: 24px;
	}

	.moves .secondary:disabled {
		opacity: 0.4;
	}
</style>
