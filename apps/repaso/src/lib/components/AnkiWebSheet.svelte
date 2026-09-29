<script lang="ts">
	import { pushState } from '$app/navigation';
	import type { Imported, PackageError } from '$lib/anki/cards';
	import { collection, IMPORTED_PER_DAY } from '$lib/collection.svelte';
	import { plural } from '$lib/format';
	import Icon from './Icon.svelte';
	import NewPerDayField from './NewPerDayField.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable() }: { open: boolean } = $props();

	// AnkiWeb lets no other site read what it serves, so searching and downloading happen on
	// AnkiWeb, in the browser: all Repaso gets is the file the browser saved.
	const SEARCH = 'https://ankiweb.net/shared/decks';

	/** What AnkiWeb finds best: its decks are named in English, whatever language they teach. */
	const TOPICS = [
		{
			title: 'Idiomas',
			items: [
				['Inglés', 'english spanish'],
				['Francés', 'french'],
				['Alemán', 'german'],
				['Italiano', 'italian'],
				['Portugués', 'portuguese'],
				['Japonés', 'japanese'],
				['Chino', 'chinese'],
				['Coreano', 'korean']
			]
		},
		{
			title: 'Ciencias y más',
			items: [
				['Anatomía', 'anatomy'],
				['Biología', 'biology'],
				['Química', 'chemistry'],
				['Física', 'physics'],
				['Geografía', 'geography'],
				['Historia', 'history'],
				['Matemáticas', 'math'],
				['Música', 'music']
			]
		}
	];

	/** How many cards the preview shows. */
	const SAMPLES = 5;

	let reading = $state<{ done: number; total: number }>();
	let error = $state('');
	/** What the file holds. It stays until imported or put aside, even if the sheet is closed. */
	let imported = $state<Imported>();
	let name = $state('');
	let perDay = $state(IMPORTED_PER_DAY);
	let picker = $state<HTMLInputElement>();

	const left = $derived(imported ? imported.total - imported.cards.length : 0);
	const leftOut = $derived(
		left === 1
			? 'Otra se queda fuera: su pregunta es solo una imagen o un audio, no tiene respuesta o repite otra.'
			: `Otras ${left} se quedan fuera: sus preguntas son solo imágenes o audio, no tienen respuesta ` +
					'o repiten otras.'
	);

	function choose() {
		const file = picker?.files?.[0];
		// Emptied, so that choosing the same file again still counts as a change.
		if (picker) picker.value = '';
		if (file) read(file);
	}

	function drop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files[0];
		if (file && !reading) read(file);
	}

	async function read(file: File) {
		error = '';
		reading = { done: 0, total: 0 };
		try {
			// Only here is the reader of Anki's files needed: it is not part of opening the app.
			const { readDeck } = await import('$lib/anki/cards');
			const deck = await readDeck(file, (done, total) => (reading = { done, total }));
			if (!deck.cards.length) {
				error =
					'Ninguna tarjeta de este mazo tiene texto propio: sus preguntas son imágenes o audio, ' +
					'que Repaso no puede mostrar.';
				return;
			}
			imported = deck;
			// AnkiWeb names the file after the deck, with its accents and spaces left out.
			name = deck.name || file.name.replace(/\.(apkg|colpkg|zip)$/i, '').replace(/_+/g, ' ').trim();
			perDay = IMPORTED_PER_DAY;
		} catch (e) {
			error = failure(e);
		} finally {
			reading = undefined;
		}
	}

	function failure(e: unknown): string {
		// Told by its name: the class is in the part of the app that only loads to read a file.
		const reason = e instanceof Error && e.name === 'PackageError' ? (e as PackageError).reason : '';
		if (reason === 'new-format') {
			return (
				'Este mazo viene en el formato más nuevo de Anki, que Repaso no sabe leer. En Anki, ' +
				'expórtalo de nuevo con la opción para versiones anteriores («Support older Anki versions»).'
			);
		}
		if (reason === 'damaged') {
			return 'El archivo parece dañado o incompleto. Descárgalo de nuevo e inténtalo otra vez.';
		}
		if (reason === 'not-anki') {
			return 'Ese archivo no es un mazo de Anki. Busca el que termina en .apkg, el que bajaste de AnkiWeb.';
		}
		return 'No se pudo leer el archivo.';
	}

	function add(event: SubmitEvent) {
		event.preventDefault();
		if (!imported || !name.trim()) return;

		const deck = collection.importDeck(name, imported.cards, perDay);
		imported = undefined;
		open = false;
		pushState('', { deck: deck.id });
	}
</script>

<Sheet bind:open title="Mazos de AnkiWeb">
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cerrar</button>
	{/snippet}

	{#if reading}
		<div class="reading" role="status">
			<span class="spinner" aria-hidden="true"></span>
			<p>Leyendo el mazo…</p>
			{#if reading.total}
				<div class="bar"><span style:width="{(reading.done / reading.total) * 100}%"></span></div>
				<p class="count">{reading.done} de {plural(reading.total, 'tarjeta', 'tarjetas')}</p>
			{/if}
		</div>
	{:else if imported}
		<form onsubmit={add}>
			<p class="lead">
				Este mazo trae {plural(imported.cards.length, 'tarjeta', 'tarjetas')} de texto.
				{#if left}{leftOut}{/if}
			</p>

			<div class="group">
				<label class="field">
					<span>Nombre</span>
					<input bind:value={name} autocomplete="off" enterkeyhint="done" />
				</label>
				<NewPerDayField bind:value={perDay} />
			</div>

			<h3 class="section-title">Así se ven</h3>
			<ul class="group samples">
				{#each imported.cards.slice(0, SAMPLES) as card, index (index)}
					<li>
						<span class="front">{card.front}</span>
						<span class="back">{card.back}</span>
					</li>
				{/each}
			</ul>

			<button class="primary" type="submit" disabled={!name.trim()}>
				Importar {plural(imported.cards.length, 'tarjeta', 'tarjetas')}
			</button>
			<button class="secondary" type="button" onclick={() => (imported = undefined)}>
				Elegir otro archivo
			</button>
		</form>
	{:else}
		<!-- A file dropped anywhere on the sheet is read too, which is handy on a computer. -->
		<div class="start" role="presentation" ondragover={(event) => event.preventDefault()} ondrop={drop}>
			<p class="lead">
				La comunidad de Anki comparte miles de mazos en AnkiWeb, gratis. Busca uno, descárgalo y ábrelo
				aquí para estudiarlo en Repaso.
			</p>

			<h3 class="section-title">1. Busca</h3>
			<form class="search" action={SEARCH} method="get" target="_blank" rel="noopener noreferrer">
				<label class="query">
					<Icon name="search" size={18} />
					<input
						type="search"
						name="search"
						placeholder="Inglés, kanji, anatomía…"
						aria-label="Buscar en AnkiWeb"
						autocomplete="off"
						enterkeyhint="search"
					/>
				</label>
				<button class="go" type="submit">Buscar</button>
			</form>

			{#each TOPICS as topic (topic.title)}
				<p class="topic">{topic.title}</p>
				<div class="chips">
					{#each topic.items as [label, query] (query)}
						<a
							class="chip"
							href="{SEARCH}?search={encodeURIComponent(query)}"
							target="_blank"
							rel="noopener noreferrer">{label}</a
						>
					{/each}
				</div>
			{/each}

			<h3 class="section-title">2. Descarga</h3>
			<p class="step">
				En la página del mazo, toca «Download». Tras unas cuantas descargas AnkiWeb pide entrar con una
				cuenta suya, que es gratis.
			</p>

			<h3 class="section-title">3. Ábrelo aquí</h3>
			<!-- No `accept`: iOS greys out files whose type it does not know, and it does not know .apkg. -->
			<input bind:this={picker} class="picker" type="file" onchange={choose} tabindex="-1" />
			<button class="primary open" type="button" onclick={() => picker?.click()}>
				<Icon name="download" />
				Elegir el archivo .apkg
			</button>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<p class="hint">
				Repaso se queda con el texto de las tarjetas, no con sus imágenes ni su audio. El archivo se lee
				aquí, en tu dispositivo, y las tarjetas se guardan en tu cuenta, como las demás. AnkiWeb no deja
				que otras páginas lean sus mazos: por eso la búsqueda se abre en su sitio.
			</p>
		</div>
	{/if}
</Sheet>

<style>
	.lead {
		margin: 0 4px 16px;
		color: var(--muted);
		font-size: 15px;
		line-height: 1.45;
	}

	.start > .section-title:first-of-type {
		margin-top: 8px;
	}

	.search {
		display: flex;
		gap: 8px;
	}

	.query {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		border-radius: 12px;
		background: var(--group);
		color: var(--faint);
	}

	.query input {
		flex: 1;
		min-width: 0;
		padding: 12px 0;
		border: 0;
		outline: none;
		background: none;
		color: var(--text);
		font-size: 17px;
	}

	.query:has(:focus-visible) {
		outline: 2px solid var(--link);
		outline-offset: 1px;
	}

	.go {
		flex: none;
		padding: 0 16px;
		border: 0;
		border-radius: 12px;
		background: var(--accent);
		color: #fff;
		font-size: 16px;
		font-weight: 600;
	}

	.topic {
		margin: 16px 4px 8px;
		color: var(--muted);
		font-size: 14px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip {
		padding: 7px 13px;
		border-radius: 999px;
		background: var(--group);
		color: var(--tint);
		font-size: 15px;
		font-weight: 500;
		text-decoration: none;
	}

	.chip:active {
		background: var(--hover);
	}

	.step {
		margin: 0 4px;
		color: var(--text);
		font-size: 15px;
		line-height: 1.45;
	}

	/* The real input stays for what it does; the button is what is seen. */
	.picker {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}

	.open {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.hint {
		margin-top: 16px;
	}

	.reading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px 16px;
		color: var(--muted);
		text-align: center;
	}

	.reading p {
		margin: 0;
	}

	.reading .spinner {
		width: 28px;
		height: 28px;
		color: var(--accent);
	}

	.bar {
		width: min(100%, 280px);
		height: 6px;
		overflow: hidden;
		border-radius: 3px;
		background: color-mix(in srgb, var(--text) 10%, transparent);
	}

	.bar span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
		transition: width 0.2s;
	}

	.count {
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.samples li {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 12px 16px;
		overflow-wrap: anywhere;
	}

	.samples li + li {
		border-top: 1px solid var(--border);
	}

	/* Some decks write paragraphs on a card: a few lines are enough to see what it is like. */
	.samples .front,
	.samples .back {
		display: -webkit-box;
		overflow: hidden;
		white-space: pre-line;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	.samples .front {
		font-size: 16px;
		font-weight: 500;
	}

	.samples .back {
		color: var(--muted);
		font-size: 15px;
	}

	.primary {
		margin-top: 16px;
	}

	.secondary {
		display: block;
		width: 100%;
		margin-top: 8px;
		padding: 12px;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 17px;
	}
</style>
