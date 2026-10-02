<script lang="ts">
	import { untrack } from 'svelte';
	import { DEFAULT_PROMPT } from '$lib/rewrite';
	import { chatModel, improving, prompt } from '$lib/settings.svelte';
	import Sheet from './Sheet.svelte';
	import Switch from './Switch.svelte';

	let { open = $bindable() }: { open: boolean } = $props();

	/** Milliseconds typing has to pause for the instructions to be saved: not a write per key. */
	const SAVE_DELAY = 800;

	let text = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	// What is saved goes into the box as the sheet opens, and what is in the box is saved as it closes.
	$effect(() => {
		if (!open) return;
		untrack(() => (text = prompt.value));
		return () => untrack(save);
	});

	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(save, SAVE_DELAY);
	}

	/** An empty box is no instructions at all: it falls back to the ones the app comes with. */
	function save() {
		clearTimeout(timer);
		const value = text.trim() || DEFAULT_PROMPT;
		if (value !== prompt.value) prompt.value = value;
	}

	function reset() {
		text = DEFAULT_PROMPT;
		save();
	}
</script>

<Sheet bind:open title="Mejorar texto">
	{#snippet trailing()}
		<button class="text-button strong" type="button" onclick={() => (open = false)}>Listo</button>
	{/snippet}

	<div class="group">
		<label class="field inline">
			<span>Mejorar texto</span>
			<Switch bind:checked={improving.value} />
		</label>
	</div>
	<p class="hint">
		Encendido, lo que dictas pasa por {chatModel.value} con estas instrucciones y lo que devuelve toma el
		lugar de la transcripción. Deshacer te devuelve lo que se oyó. El botón «Mejorar» hace lo mismo con
		todo el texto cuando lo tocas, esté encendido o no.
	</p>

	<h3 class="section-title">Instrucciones</h3>
	<div class="group">
		<label class="field">
			<textarea
				bind:value={text}
				{oninput}
				onchange={save}
				aria-label="Instrucciones"
				placeholder={DEFAULT_PROMPT}
				maxlength="4000"
			></textarea>
		</label>
	</div>
	<p class="hint">
		Por ejemplo: «Hazlo un correo formal», «Tradúcelo al inglés» o «Ponlo en una lista con viñetas».
	</p>

	{#if text.trim() !== DEFAULT_PROMPT}
		<button class="text-button reset" type="button" onclick={reset}>Restablecer</button>
	{/if}
</Sheet>

<style>
	.reset {
		display: block;
		margin: 16px auto 0;
	}
</style>
