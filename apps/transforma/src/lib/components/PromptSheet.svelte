<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { prompts, titleOf, type Prompt } from '$lib/prompts.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		/** A prompt already there: the sheet changes or deletes it instead of creating one. */
		prompt?: Prompt;
		/** Receives the prompt just created. */
		oncreate?: (prompt: Prompt) => void;
	}

	let { open = $bindable(), prompt, oncreate }: Props = $props();

	let title = $state('');
	let instructions = $state('');
	let field = $state<HTMLTextAreaElement>();

	/** The name it goes by while the user gives it none, shown where theirs would go. */
	const automatic = $derived(prompt && !prompt.title ? titleOf(prompt) : '');

	// Every time the sheet opens it starts blank, or from the prompt being edited.
	$effect(() => {
		if (!open) return;

		untrack(() => {
			title = prompt?.title ?? '';
			instructions = prompt?.instructions ?? '';
		});
		if (!prompt) tick().then(() => field?.focus());
	});

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!instructions.trim()) return;

		open = false;
		if (prompt) prompts.update(prompt.id, title, instructions);
		else oncreate?.(prompts.add(title, instructions));
	}

	function remove() {
		if (!prompt || !confirm(`¿Eliminar «${titleOf(prompt)}»?`)) return;

		open = false;
		prompts.remove(prompt.id);
		// Its screen goes with it: back to the list of prompts.
		history.back();
	}

	/** ⌘/Ctrl + Enter saves from the instructions, where Enter alone starts a new line. */
	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
		event.preventDefault();
		(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
	}
</script>

<Sheet bind:open title={prompt ? 'Editar prompt' : 'Nuevo prompt'}>
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}

	<form onsubmit={save}>
		<div class="group">
			<label class="field">
				<span>Instrucciones</span>
				<textarea
					bind:this={field}
					bind:value={instructions}
					placeholder="Ej.: Reescribe el texto con un tono formal y respetuoso, sin cambiar lo que dice."
					autocapitalize="sentences"
					{onkeydown}
				></textarea>
			</label>
			<label class="field">
				<span>Título</span>
				<input
					bind:value={title}
					placeholder={automatic || 'Opcional'}
					autocapitalize="sentences"
					autocomplete="off"
					enterkeyhint="done"
				/>
			</label>
		</div>
		<p class="hint">
			Las instrucciones dicen en qué convertir el texto que pegues o escribas: un tono, un público, un
			formato. Sin título, se le pone uno solo a partir de ellas.
		</p>

		<button class="primary" type="submit" disabled={!instructions.trim()}>
			{prompt ? 'Guardar' : 'Crear prompt'}
		</button>
	</form>

	{#if prompt}
		<button class="destructive" type="button" onclick={remove}>Eliminar prompt</button>
	{/if}
</Sheet>

<style>
	.primary {
		margin-top: 16px;
	}
</style>
