<script lang="ts">
	import { untrack } from 'svelte';
	import { parse, parseMarkdown, toMarkdown, type TableData } from '$lib/markdown';
	import Icon from './Icon.svelte';

	interface Props {
		table: TableData;
		onchange: (next: TableData, key?: string) => void;
	}

	let { table, onchange }: Props = $props();

	const markdown = $derived(toMarkdown(table));

	/**
	 * What the box holds. While it is being typed in, it is the user's text, which only has to read
	 * as a table to be applied; once it loses the focus it is the table's Markdown again, padded.
	 */
	let text = $state(untrack(() => markdown));
	let focused = $state(false);
	let invalid = $state(false);
	let copied = $state(false);
	let notice = $state('');
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	// Changed from elsewhere — undone, say — the box follows, unless it is being typed in.
	$effect(() => {
		const next = markdown;
		if (!untrack(() => focused)) text = next;
	});

	function oninput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		text = event.currentTarget.value;
		// Pasting a spreadsheet's cells over it is a table too.
		const next = parseMarkdown(text) ?? (text.includes('\t') ? parse(text) : undefined);
		invalid = !next;
		if (next && toMarkdown(next) !== markdown) onchange(next, 'markdown');
	}

	function onblur() {
		focused = false;
		invalid = false;
		text = markdown;
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(markdown);
			notice = '';
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 1500);
		} catch {
			// Not allowed, or not offered: the text can still be selected and copied by hand.
			notice = 'No se pudo copiar. Selecciona el texto y cópialo a mano.';
		}
	}
</script>

<div class="pane">
	<label class="box">
		<span class="visually-hidden">Markdown de la tabla</span>
		<textarea
			value={text}
			{oninput}
			onfocus={() => (focused = true)}
			{onblur}
			autocapitalize="off"
			autocomplete="off"
			spellcheck="false"
			wrap="off"
		></textarea>
	</label>

	<p class="status" class:error={invalid || notice !== ''} role="status">
		{#if notice}
			{notice}
		{:else if invalid}
			Así no se lee como una tabla: falta el encabezado o la fila de guiones bajo él. Los cambios se
			aplican en cuanto vuelva a serlo.
		{:else}
			Puedes editarla aquí también: lo que escribas cambia la tabla.
		{/if}
	</p>
</div>

<footer>
	<button class="primary" type="button" onclick={copy}>
		<Icon name={copied ? 'check' : 'copy'} />
		{copied ? 'Copiado' : 'Copiar Markdown'}
	</button>
</footer>

<style>
	.pane {
		flex: 1;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: 4px 16px 0;
	}

	.box {
		display: block;
		overflow: hidden;
		border-radius: 14px;
		background: var(--group);
	}

	textarea {
		display: block;
		width: 100%;
		min-height: 45dvh;
		padding: 14px 16px;
		border: 0;
		outline: none;
		background: none;
		font-family: var(--mono);
		font-size: 14px;
		line-height: 1.55;
		white-space: pre;
		overflow-x: auto;
		resize: vertical;
		tab-size: 4;
	}

	.status {
		margin: 8px 4px 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.45;
	}

	.status.error {
		color: var(--danger);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	/* The button stays at hand however long the table runs. */
	footer {
		position: sticky;
		bottom: 0;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: 16px 16px calc(12px + env(safe-area-inset-bottom));
		background: linear-gradient(transparent, var(--bg) 16px);
	}

	footer .primary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}
</style>
