<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { canCopyImage, canShare, copyImage, fileOf, saveImage } from '$lib/image';
	import type { TableData } from '$lib/markdown';
	import { render } from '$lib/render';
	import {
		columnWidthOf,
		defaultSizes,
		defaultWidth,
		MAX_SIZE,
		MAX_WIDTH,
		MIN_SIZE,
		MIN_WIDTH,
		sizesOf,
		styleOf,
		styles,
		type Sizes,
		type Style,
		WIDTH_STEP
	} from '$lib/styles';
	import { tables, titleOf, type Table } from '$lib/tables.svelte';
	import Icon from './Icon.svelte';

	let { table }: { table: Table } = $props();

	interface Shown {
		url: string;
		blob: Blob;
		file: File;
		width: number;
		height: number;
		scale: number;
	}

	/** A change waits this long to be drawn, in case another follows: typing, or tapping through the styles. */
	const REDRAW_DELAY = 150;

	const style = $derived(styleOf(table.style));
	const sizes = $derived(sizesOf(style, table.headerSize, table.bodySize));
	const width = $derived(columnWidthOf(style, table.columnWidth));
	const ownSizes = $derived(table.headerSize > 0 || table.bodySize > 0 || table.columnWidth > 0);

	let image = $state<Shown>();
	let drawing = $state(true);
	let failure = $state('');
	let copied = $state(false);
	let notice = $state('');
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	/** The address the preview is shown from, let go of once another takes its place. */
	let address = '';
	onDestroy(() => URL.revokeObjectURL(address));

	// Drawn anew for every change, the latest one winning: a drawing that a later change overtook is
	// thrown away.
	$effect(() => {
		const data: TableData = $state.snapshot({ cells: table.cells, align: table.align });
		const look = style;
		const text = { ...sizes };
		const column = width;
		const title = table.title;
		const name = titleOf(table);

		let stale = false;
		drawing = true;
		const timer = setTimeout(
			async () => {
				try {
					const drawn = await render(data, look, text, column, title);
					if (stale) return;
					URL.revokeObjectURL(address);
					address = URL.createObjectURL(drawn.blob);
					image = { ...drawn, url: address, file: fileOf(drawn.blob, name) };
					failure = '';
				} catch (thrown) {
					if (!stale) failure = thrown instanceof Error ? thrown.message : 'No se pudo crear la imagen.';
				} finally {
					if (!stale) drawing = false;
				}
			},
			// The first drawing goes at once. Reading `image` here must not make it a dependency: setting
			// it would draw again, forever.
			untrack(() => image) ? REDRAW_DELAY : 0
		);
		return () => {
			stale = true;
			clearTimeout(timer);
		};
	});

	const shares = $derived(image ? canShare(image.file) : false);
	const copies = canCopyImage();

	// Straight from the tap, with the image already drawn: Safari refuses the share sheet otherwise.
	function save() {
		if (image) saveImage(image.file);
	}

	function copy() {
		if (!image) return;
		copyImage(image.blob).then(
			() => {
				notice = '';
				copied = true;
				clearTimeout(copiedTimer);
				copiedTimer = setTimeout(() => (copied = false), 1500);
			},
			() => (notice = 'No se pudo copiar la imagen. Guárdala y compártela desde Fotos.')
		);
	}

	function resize(part: keyof Sizes, size: number) {
		// Back at the style's own size it goes by the style again, and follows it to another one.
		size = Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
		tables.resize(table.id, part, size === defaultSizes(style)[part] ? 0 : size);
	}

	function widen(next: number) {
		next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next));
		tables.widen(table.id, next === defaultWidth(style) ? 0 : next);
	}

	/**
	 * What was typed into a value, once it is done with: kept within bounds, or put back as it was
	 * when it is not a number. The field is set by hand, since a value clamped to the one it already
	 * had changes nothing that would redraw it.
	 */
	function typed(field: HTMLInputElement, value: number, min: number, max: number, set: (next: number) => void) {
		const number = Number.parseInt(field.value.replace(/[^\d]/g, ''), 10);
		const next = Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : value;
		if (next !== value) set(next);
		field.value = String(next);
	}

	function resetSizes() {
		tables.resize(table.id, 'header', 0);
		tables.resize(table.id, 'body', 0);
		tables.widen(table.id, 0);
	}

	/** What the frame around a style's table looks like, for its swatch. */
	function frameOf(look: Style): string {
		const background = look.frame?.background ?? look.background;
		return Array.isArray(background) ? `linear-gradient(135deg, ${background.join(', ')})` : background;
	}
</script>

<div class="pane">
	<div class="preview" class:busy={drawing}>
		{#if image}
			<img
				src={image.url}
				width={Math.round(image.width / image.scale)}
				height={Math.round(image.height / image.scale)}
				alt={`La tabla en el estilo ${style.name}`}
			/>
		{:else if !failure}
			<span class="spinner" aria-label="Creando la imagen"></span>
		{/if}
	</div>

	<p class="status" class:error={failure !== '' || notice !== ''} role="status">
		{#if failure}
			{failure}
		{:else if notice}
			{notice}
		{:else if image}
			{image.width} × {image.height} px · PNG
		{/if}
	</p>

	<h2 class="section-title">Estilo</h2>
	<div class="styles">
		{#each styles as look (look.id)}
			<button
				class="style"
				type="button"
				aria-pressed={look.id === style.id}
				onclick={() => tables.restyle(table.id, look.id)}
			>
				<span class="swatch" style:background={frameOf(look)}>
					<span
						class="card"
						class:framed={look.frame !== undefined}
						style:background={look.background}
						style:border-radius={look.radius ? '5px' : '0'}
						style:outline-color={look.lines.outer === 'box' ? look.lines.color : 'transparent'}
					>
						{#if look.window}
							<span class="bar" style:background={look.window.background}>
								<i></i><i></i><i></i>
							</span>
						{/if}
						<span
							class="row head"
							style:background={look.header.background}
							style:border-bottom-color={look.headerRule?.color ??
								(look.lines.horizontal || look.lines.vertical ? look.lines.color : 'transparent')}
						>
							<b style:background={look.header.text}></b><b style:background={look.header.text}></b>
						</span>
						{#each [1, 2, 3] as n (n)}
							<span
								class="row"
								style:background={n === 2 && look.stripe ? look.stripe : 'transparent'}
								style:border-bottom-color={look.lines.horizontal && n < 3 ? look.lines.color : 'transparent'}
							>
								<b style:background={look.text}></b><b style:background={look.text}></b>
							</span>
						{/each}
					</span>
				</span>
				<span class="name">{look.name}</span>
			</button>
		{/each}
	</div>

	<div class="heading">
		<h2 class="section-title">Tamaño</h2>
		{#if ownSizes}
			<button class="text-button" type="button" onclick={resetSizes}>Restablecer</button>
		{/if}
	</div>
	<div class="group">
		{@render stepper('Letra de títulos', sizes.header, MIN_SIZE, MAX_SIZE, 1, (next) => resize('header', next))}
		{@render stepper('Letra de celdas', sizes.body, MIN_SIZE, MAX_SIZE, 1, (next) => resize('body', next))}
		{@render stepper('Ancho de columnas', width, MIN_WIDTH, MAX_WIDTH, WIDTH_STEP, widen)}
	</div>
	<p class="hint">
		Ninguna columna pasa del ancho elegido: el texto más largo sigue en la línea de abajo, y una columna
		con poco texto queda más angosta.
	</p>
</div>

{#snippet stepper(
	label: string,
	value: number,
	min: number,
	max: number,
	step: number,
	set: (next: number) => void
)}
	<div class="field inline">
		<span>{label}</span>
		<div class="stepper">
			<button type="button" onclick={() => set(value - step)} disabled={value <= min} aria-label={`${label}: menos`}>
				−
			</button>
			<label class="value">
				<input
					type="text"
					inputmode="numeric"
					enterkeyhint="done"
					autocomplete="off"
					value={value}
					aria-label={`${label}, en píxeles`}
					onfocus={(event) => event.currentTarget.select()}
					onkeydown={(event) => {
						if (event.key === 'Enter') event.currentTarget.blur();
						else if (event.key === 'Escape') {
							event.currentTarget.value = String(value);
							event.currentTarget.blur();
						}
					}}
					onchange={(event) => typed(event.currentTarget, value, min, max, set)}
				/>
				<span>px</span>
			</label>
			<button type="button" onclick={() => set(value + step)} disabled={value >= max} aria-label={`${label}: más`}>
				+
			</button>
		</div>
	</div>
{/snippet}

<footer>
	<div class="actions">
		{#if copies}
			<button class="secondary" type="button" onclick={copy} disabled={!image || drawing}>
				<Icon name={copied ? 'check' : 'copy'} />
				{copied ? 'Copiada' : 'Copiar'}
			</button>
		{/if}
		<button class="primary" type="button" onclick={save} disabled={!image || drawing}>
			<Icon name={shares ? 'share' : 'download'} />
			{shares ? 'Compartir' : 'Descargar'}
		</button>
	</div>
</footer>

<style>
	.pane {
		flex: 1;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: 4px 16px 0;
	}

	.preview {
		display: grid;
		place-items: center;
		min-height: 160px;
		padding: 16px;
		overflow: hidden;
		border-radius: 16px;
		background: var(--group);
	}

	.preview img {
		display: block;
		max-width: 100%;
		height: auto;
		box-shadow: 0 1px 6px rgb(0 0 0 / 0.12);
		transition: opacity 0.15s;
	}

	/* What is shown is about to be replaced: a hint of it, rather than a spinner over every key. */
	.preview.busy img {
		opacity: 0.6;
	}

	.status {
		min-height: 1.4em;
		margin: 8px 4px 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.4;
		text-align: center;
	}

	.status.error {
		color: var(--danger);
	}

	.styles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 10px;
	}

	.style {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 6px;
		padding: 6px 6px 8px;
		border: 0;
		border-radius: 14px;
		background: var(--group);
		box-shadow: inset 0 0 0 1.5px transparent;
		color: var(--text);
		transition: box-shadow 0.15s;
	}

	.style[aria-pressed='true'] {
		box-shadow: inset 0 0 0 2.5px var(--accent);
	}

	.style[aria-pressed='true'] .name {
		color: var(--tint);
		font-weight: 600;
	}

	.swatch {
		display: flex;
		align-items: center;
		justify-content: center;
		aspect-ratio: 16 / 10;
		overflow: hidden;
		border-radius: 9px;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.06);
	}

	.card {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		overflow: hidden;
		outline: 1px solid transparent;
		outline-offset: -1px;
	}

	.card.framed {
		width: 76%;
		height: 72%;
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.14);
	}

	.bar {
		display: flex;
		flex: none;
		gap: 2px;
		padding: 3px 4px;
	}

	.bar i {
		width: 4px;
		height: 4px;
		border-radius: 50%;
		background: #ff5f57;
	}

	.bar i:nth-child(2) {
		background: #febc2e;
	}

	.bar i:nth-child(3) {
		background: #28c840;
	}

	.row {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 12%;
		padding: 0 10%;
		border-bottom: 1px solid transparent;
	}

	.row b {
		height: 3px;
		flex: 1;
		border-radius: 2px;
		opacity: 0.55;
	}

	.head b {
		height: 4px;
		opacity: 0.9;
	}

	.name {
		font-size: 13px;
		text-align: center;
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

	.value {
		display: flex;
		align-items: baseline;
		gap: 3px;
		padding: 0 4px;
		color: var(--muted);
		font-size: 15px;
	}

	/* 17px, as everything else: under 16px iOS zooms the page in on focusing it. */
	.value input {
		width: 4ch;
		padding: 4px 0;
		border: 0;
		border-bottom: 1px solid var(--border);
		border-radius: 0;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 17px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.value input:focus {
		border-bottom-color: var(--accent);
		outline: none;
	}

	footer {
		position: sticky;
		bottom: 0;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: 16px 16px calc(12px + env(safe-area-inset-bottom));
		background: linear-gradient(transparent, var(--bg) 16px);
	}

	.actions {
		display: flex;
		gap: 10px;
	}

	.actions button {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.secondary {
		padding: 14px;
		border: 0;
		border-radius: 14px;
		background: var(--group);
		box-shadow: var(--shadow);
		color: var(--tint);
		font-size: 17px;
		font-weight: 600;
		transition: transform 0.1s;
	}

	.secondary:active:not(:disabled) {
		transform: scale(0.98);
	}

	.secondary:disabled {
		opacity: 0.4;
	}
</style>
