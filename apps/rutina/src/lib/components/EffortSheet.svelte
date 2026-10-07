<script lang="ts">
	// «Cambiar esfuerzo»: the repetitions — or seconds — and the weight a set was actually done at.
	// It opens on what was expected, so that only what changed has to be touched.
	import { untrack } from 'svelte';
	import type { RutinaBlock } from '@leo-os/shared';
	import { formatWeight } from '$lib/effort';
	import { LIMITS } from '$lib/routine';
	import Sheet from './Sheet.svelte';
	import Stepper from './Stepper.svelte';

	let {
		open = $bindable(),
		expected,
		timed,
		onsave
	}: {
		open: boolean;
		expected: RutinaBlock;
		timed: boolean;
		onsave: (block: RutinaBlock) => void;
	} = $props();

	// Filled in again from `expected` every time it opens.
	let reps = $state(untrack(() => expected.reps));
	let weight = $state(untrack(() => expected.weight));

	$effect(() => {
		if (!open) return;
		reps = expected.reps;
		weight = expected.weight;
	});

	function save() {
		open = false;
		onsave({ reps, weight });
	}
</script>

<Sheet bind:open title="¿Cuánto hiciste?">
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}
	{#snippet trailing()}
		<button class="text-button strong" type="button" onclick={save}>Guardar</button>
	{/snippet}

	<div class="group">
		<div class="field inline">
			<span>{timed ? 'Segundos' : 'Repeticiones'}</span>
			<Stepper
				bind:value={reps}
				min={1}
				max={LIMITS.reps}
				step={timed ? 5 : 1}
				label={timed ? 'Segundos' : 'Repeticiones'}
			/>
		</div>
		<div class="field inline">
			<span>Peso (kg)</span>
			<Stepper
				bind:value={weight}
				min={0}
				max={1000}
				step={1}
				precision={0.25}
				label="Peso en kilogramos"
				format={(value) => (value > 0 ? formatWeight(value) : 'Sin peso')}
			/>
		</div>
	</div>

	<button class="primary save" type="button" onclick={save}>Guardar serie</button>
</Sheet>

<style>
	.save {
		margin-top: 16px;
	}
</style>
