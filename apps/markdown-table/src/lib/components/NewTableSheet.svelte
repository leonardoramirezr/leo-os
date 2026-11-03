<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { blank } from '$lib/edit';
	import { parse } from '$lib/markdown';
	import { tables } from '$lib/tables.svelte';
	import Icon from './Icon.svelte';
	import MiniTable from './MiniTable.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		/** Whether it starts from something pasted or from an empty table. */
		mode: 'paste' | 'blank';
		/** Receives the id of the table just created. */
		oncreate: (id: string) => void;
	}

	let { open = $bindable(), mode = $bindable(), oncreate }: Props = $props();

	const MAX_COLUMNS = 20;
	const MAX_ROWS = 50;

	const EXAMPLE = '| Nombre | Edad |\n| ------ | ---: |\n| Ana    |   31 |';

	let title = $state('');
	let text = $state('');
	let columns = $state(3);
	let rows = $state(3);
	let notice = $state('');
	let field = $state<HTMLTextAreaElement>();

	const parsed = $derived(parse(text));
	const canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function';

	/** What was read out of the text, in words. */
	const summary = $derived.by(() => {
		if (!parsed) return '';
		const count = parsed.align.length;
		const body = parsed.cells.length - 1;
		const across = count === 1 ? '1 columna' : `${count} columnas`;
		const down = body === 1 ? '1 fila' : `${body} filas`;
		return `Una tabla de ${across} y ${down}, además del encabezado.`;
	});

	// Every time the sheet opens it starts empty.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			title = '';
			text = '';
			columns = 3;
			rows = 3;
			notice = '';
		});
	});

	// Ready to paste into, on a computer. On a phone the keyboard would cover the sheet's buttons.
	$effect(() => {
		if (open && mode === 'paste' && !matchMedia('(pointer: coarse)').matches) tick().then(() => field?.focus());
	});

	async function paste() {
		try {
			text = await navigator.clipboard.readText();
			notice = text.trim() ? '' : 'El portapapeles está vacío.';
		} catch {
			notice = 'No se pudo leer el portapapeles. Mantén presionado el recuadro y elige Pegar.';
		}
	}

	function create(event: SubmitEvent) {
		event.preventDefault();
		const data = mode === 'paste' ? parsed : blank(columns, rows);
		if (!data) return;

		open = false;
		oncreate(tables.add(data, title));
	}
</script>

{#snippet stepper(label: string, value: number, min: number, max: number, set: (next: number) => void)}
	<div class="field inline">
		<span>{label}</span>
		<div class="stepper">
			<button type="button" onclick={() => set(value - 1)} disabled={value <= min} aria-label={`Menos ${label.toLowerCase()}`}>
				−
			</button>
			<output>{value}</output>
			<button type="button" onclick={() => set(value + 1)} disabled={value >= max} aria-label={`Más ${label.toLowerCase()}`}>
				+
			</button>
		</div>
	</div>
{/snippet}

<Sheet bind:open title="Nueva tabla">
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}

	<form onsubmit={create}>
		<div class="segmented" role="tablist" aria-label="Cómo empezar">
			<button type="button" role="tab" aria-selected={mode === 'paste'} onclick={() => (mode = 'paste')}>
				<Icon name="paste" size={16} />
				Pegar
			</button>
			<button type="button" role="tab" aria-selected={mode === 'blank'} onclick={() => (mode = 'blank')}>
				<Icon name="table" size={16} />
				En blanco
			</button>
		</div>

		<div class="group">
			<label class="field">
				<span>Título</span>
				<input bind:value={title} placeholder="Opcional" autocapitalize="sentences" autocomplete="off" enterkeyhint="done" />
			</label>
		</div>

		{#if mode === 'paste'}
			<div class="heading">
				<h2 class="section-title">Tabla</h2>
				{#if canPaste}
					<button class="text-button" type="button" onclick={paste}>Pegar del portapapeles</button>
				{/if}
			</div>
			<div class="group">
				<label class="field">
					<span class="visually-hidden">Texto de la tabla</span>
					<textarea
						bind:this={field}
						bind:value={text}
						class="code"
						placeholder={EXAMPLE}
						autocapitalize="off"
						autocomplete="off"
						spellcheck="false"
						wrap="off"
					></textarea>
				</label>
			</div>

			{#if notice}
				<p class="error">{notice}</p>
			{:else if parsed}
				<p class="hint found">{summary}</p>
				<div class="preview"><MiniTable table={parsed} /></div>
			{:else if text.trim()}
				<p class="error">
					Aquí no hay una tabla. Pega filas con sus celdas separadas por <code>|</code>, o celdas
					copiadas de una hoja de cálculo.
				</p>
			{:else}
				<p class="hint">
					Una tabla en Markdown, celdas copiadas de Numbers, Excel o Google Sheets, o un CSV. La primera
					fila es el encabezado.
				</p>
			{/if}
		{:else}
			<h2 class="section-title">Tamaño</h2>
			<div class="group">
				{@render stepper('Columnas', columns, 1, MAX_COLUMNS, (next) => (columns = next))}
				{@render stepper('Filas', rows, 1, MAX_ROWS, (next) => (rows = next))}
			</div>
			<p class="hint">Además de las filas, la tabla tiene su encabezado. Después puedes agregar o quitar las que quieras.</p>
		{/if}

		<button class="primary" type="submit" disabled={mode === 'paste' && !parsed}>Crear tabla</button>
	</form>
</Sheet>

<style>
	.segmented {
		margin-bottom: 16px;
	}

	.heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.heading .text-button {
		margin-right: 16px;
		font-size: 15px;
	}

	textarea.code {
		min-height: calc(7 * 1.45em);
		max-height: 40dvh;
		font-family: var(--mono);
		font-size: 14px;
		line-height: 1.45;
		white-space: pre;
		overflow-x: auto;
	}

	.found {
		color: var(--tint);
		font-weight: 600;
	}

	.preview {
		margin-top: 10px;
	}

	code {
		font-family: var(--mono);
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.stepper button {
		display: grid;
		place-items: center;
		width: 36px;
		height: 32px;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background: var(--handle);
		color: var(--text);
		font-size: 20px;
		line-height: 1;
	}

	.stepper button:disabled {
		opacity: 0.35;
	}

	output {
		min-width: 2.2em;
		font-size: 17px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.primary {
		margin-top: 20px;
	}
</style>
