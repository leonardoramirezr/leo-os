<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { questions } from '$lib/template';
	import { templates, titleOf, type Template } from '$lib/templates.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		/** A template already there: the sheet changes or deletes it instead of creating one. */
		template?: Template;
		/** Receives the template just created. */
		oncreate?: (template: Template) => void;
	}

	let { open = $bindable(), template, oncreate }: Props = $props();

	/** What «Insertar pregunta» puts in when nothing is selected, selected to be typed over. */
	const PLACEHOLDER = 'Pregunta';

	let title = $state('');
	let body = $state('');
	let field = $state<HTMLTextAreaElement>();

	const asked = $derived(questions(body).length);

	// Every time the sheet opens it starts blank, or from the template being edited.
	$effect(() => {
		if (!open) return;

		untrack(() => {
			title = template?.title ?? '';
			body = template?.body ?? '';
		});
		if (!template) tick().then(() => field?.focus());
	});

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!body.trim()) return;

		open = false;
		if (template) templates.update(template.id, title, body);
		else oncreate?.(templates.add(title, body));
	}

	function remove() {
		if (!template || !confirm(`¿Eliminar «${titleOf(template)}»?`)) return;

		open = false;
		templates.remove(template.id);
		// Its screen goes with it: back to the list of templates.
		history.back();
	}

	/**
	 * Three brackets on each side are a chore to type on a phone. This puts them around what is
	 * selected, or around a word to type over where the cursor is.
	 */
	async function insertBlank() {
		if (!field) return;

		const start = field.selectionStart;
		const end = field.selectionEnd;
		const inside = body.slice(start, end) || PLACEHOLDER;
		body = `${body.slice(0, start)}[[[${inside}]]]${body.slice(end)}`;

		await tick();
		field.focus();
		field.setSelectionRange(start + 3, start + 3 + inside.length);
	}

	/** Keeps the focus, and the cursor, in the text while the button is tapped. */
	function keepFocus(event: MouseEvent) {
		event.preventDefault();
	}

	/** ⌘/Ctrl + Enter saves from the text, where Enter alone starts a new line. */
	function onkeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
		event.preventDefault();
		(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
	}
</script>

<Sheet bind:open title={template ? 'Editar plantilla' : 'Nueva plantilla'}>
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}

	<form onsubmit={save}>
		<div class="group">
			<label class="field">
				<span>Título</span>
				<input
					bind:value={title}
					placeholder="Opcional"
					autocapitalize="sentences"
					autocomplete="off"
					enterkeyhint="next"
				/>
			</label>
			<label class="field">
				<span>Texto</span>
				<textarea
					bind:this={field}
					bind:value={body}
					placeholder="Ej.: Escribe un correo para [[[¿A quién va dirigido?]]] explicando [[[¿Qué quieres decir?]]]."
					autocapitalize="sentences"
					{onkeydown}
				></textarea>
			</label>
		</div>

		<div class="tools">
			<button class="insert" type="button" onmousedown={keepFocus} onclick={insertBlank}>
				<Icon name="blank" size={18} />
				Insertar pregunta
			</button>
			<span class="count">
				{asked === 0 ? 'Sin preguntas' : asked === 1 ? '1 pregunta' : `${asked} preguntas`}
			</span>
		</div>

		<p class="hint">
			Escribe el prompt y pon entre tres corchetes, <code>[[[así]]]</code>, cada oración o pregunta que
			quieras responder al usarlo. Una misma pregunta escrita dos veces se responde una sola.
		</p>

		<button class="primary" type="submit" disabled={!body.trim()}>
			{template ? 'Guardar' : 'Crear plantilla'}
		</button>
	</form>

	{#if template}
		<button class="destructive" type="button" onclick={remove}>Eliminar plantilla</button>
	{/if}
</Sheet>

<style>
	.tools {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 10px 4px 0;
	}

	.insert {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border: 0;
		border-radius: 999px;
		background: var(--blank-bg);
		color: var(--blank);
		font-size: 15px;
		font-weight: 600;
	}

	.count {
		color: var(--muted);
		font-size: 13px;
	}

	code {
		font-family: var(--mono);
		font-size: 12px;
		color: var(--blank);
	}

	.primary {
		margin-top: 16px;
	}
</style>
