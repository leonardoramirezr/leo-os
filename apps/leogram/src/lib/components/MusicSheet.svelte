<script lang="ts">
	// «Añadir música»: a song from Apple's catalog — any song anyone knows, as a 30-second preview —
	// or one of the device's own, an MP3 of any length. Then, its moment.
	import { onDestroy } from 'svelte';
	import { searchCatalog, type CatalogSong } from '$lib/music/catalog';
	import { CLIP_SECONDS, decode, peaks, readUpload, type Upload } from '$lib/music/clip';
	import { Player } from '$lib/music/player.svelte';
	import type { DraftMusic } from '$lib/posts.svelte';
	import Icon from './Icon.svelte';
	import MomentPicker from './MomentPicker.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable(), onpick }: { open: boolean; onpick: (music: DraftMusic) => void } = $props();

	/** How many bars the song is drawn with. */
	const BARS = 64;

	/** A song on its way to being picked: what is known of it, and its moment. */
	interface Choice {
		title: string;
		artist: string;
		artwork: string;
		song?: CatalogSong;
		upload?: Upload;
		src: string;
		duration: number;
		levels: number[];
		start: number;
	}

	let tab = $state<'catalog' | 'upload'>('catalog');
	let query = $state('');
	let results = $state<CatalogSong[]>([]);
	let searching = $state(false);
	let searched = $state('');
	let problem = $state('');
	let choice = $state<Choice>();
	let preparing = $state('');
	/** The preview playing in the list, by its address. */
	let listening = $state('');

	let listPlayer: Player | undefined;
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	let searchAbort: AbortController | undefined;
	let picker = $state<HTMLInputElement>();

	onDestroy(() => {
		stopListening();
		clearTimeout(searchTimer);
		searchAbort?.abort();
	});

	// Closing it stops whatever was playing in it.
	$effect(() => {
		if (!open) {
			stopListening();
			drop();
		}
	});

	/** Lets go of a song looked at and not picked: a file of the device's is held whole in memory. */
	function drop() {
		if (choice?.upload) URL.revokeObjectURL(choice.upload.url);
		choice = undefined;
	}

	function stopListening() {
		listPlayer?.destroy();
		listPlayer = undefined;
		listening = '';
	}

	function oninput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(search, 400);
	}

	async function search() {
		const term = query.trim();
		searchAbort?.abort();
		if (!term) {
			results = [];
			searched = '';
			return;
		}
		const controller = (searchAbort = new AbortController());
		searching = true;
		problem = '';
		try {
			results = await searchCatalog(term, controller.signal);
			searched = term;
		} catch (thrown) {
			if (controller.signal.aborted) return;
			problem = thrown instanceof Error ? thrown.message : 'No se pudo buscar.';
		} finally {
			if (searchAbort === controller) searching = false;
		}
	}

	function listen(song: CatalogSong) {
		const playing = listening === song.url;
		stopListening();
		if (playing) return;
		listPlayer = new Player(song.url, 0, CLIP_SECONDS);
		listPlayer.play();
		listening = song.url;
	}

	/** Bars of the same height, for a song the browser could not draw: its moment is picked all the same. */
	function flat(): number[] {
		return Array.from({ length: BARS }, (_, i) => 0.35 + 0.25 * Math.abs(Math.sin(i * 1.7)));
	}

	/**
	 * Where a long song starts by default: the loudest stretch of a clip's length, which is more
	 * often than not its chorus.
	 */
	function loudest(levels: number[], duration: number): number {
		const span = Math.max(1, Math.round((CLIP_SECONDS / duration) * levels.length));
		let best = 0;
		let bestSum = -1;
		for (let from = 0; from + span <= levels.length; from++) {
			const sum = levels.slice(from, from + span).reduce((total, level) => total + level, 0);
			if (sum > bestSum) [best, bestSum] = [from, sum];
		}
		return Math.round((best / levels.length) * duration);
	}

	async function chooseSong(song: CatalogSong) {
		stopListening();
		preparing = song.url;
		problem = '';
		try {
			// Drawn from the preview itself, which Apple lets any page read.
			const audio = await fetch(song.url)
				.then((response) => response.arrayBuffer())
				.then(decode)
				.catch(() => undefined);
			choice = {
				title: song.title,
				artist: song.artist,
				artwork: song.artwork,
				song,
				src: song.url,
				duration: audio?.duration ?? CLIP_SECONDS,
				levels: audio ? peaks(audio, BARS) : flat(),
				start: 0
			};
		} finally {
			preparing = '';
		}
	}

	async function chooseFile() {
		const file = picker?.files?.[0];
		if (picker) picker.value = '';
		if (!file) return;
		stopListening();
		preparing = 'file';
		problem = '';
		try {
			const upload = await readUpload(file);
			drop();
			if (!upload) {
				problem = 'Ese archivo no es una canción que se pueda leer. Prueba con un MP3.';
				return;
			}
			const levels = upload.audio ? peaks(upload.audio, BARS) : flat();
			choice = {
				title: upload.title,
				artist: upload.artist,
				artwork: '',
				upload,
				src: upload.url,
				duration: upload.duration,
				levels,
				start: upload.duration > CLIP_SECONDS ? loudest(levels, upload.duration) : 0
			};
		} catch {
			problem = 'No se pudo leer el archivo.';
		} finally {
			preparing = '';
		}
	}

	function done() {
		if (!choice) return;
		const { title, artist, song, upload, start, duration } = choice;
		onpick({
			title: title.trim() || 'Sin título',
			artist: artist.trim(),
			song,
			upload,
			start,
			length: Math.min(CLIP_SECONDS, duration - start)
		});
		// Picked: its file is the composer's to keep now.
		choice = undefined;
		open = false;
	}
</script>

<Sheet bind:open title={choice ? 'Elige el momento' : 'Añadir música'}>
	{#snippet leading()}
		{#if choice}
			<button class="text-button" type="button" onclick={drop}>Atrás</button>
		{:else}
			<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
		{/if}
	{/snippet}
	{#snippet trailing()}
		{#if choice}
			<button class="text-button blue" type="button" onclick={done}>Listo</button>
		{/if}
	{/snippet}

	{#if choice}
		<div class="song">
			{#if choice.artwork}
				<img class="art large" src={choice.artwork} alt="" />
			{:else}
				<span class="art large blank"><Icon name="music" size={28} /></span>
			{/if}
			{#if choice.upload}
				<div class="names">
					<input bind:value={choice.title} placeholder="Título" aria-label="Título" />
					<input bind:value={choice.artist} placeholder="Artista" aria-label="Artista" />
				</div>
			{:else}
				<div class="names">
					<strong>{choice.title}</strong>
					<span>{choice.artist}</span>
				</div>
			{/if}
		</div>
		{#key choice.src}
			<MomentPicker
				src={choice.src}
				duration={choice.duration}
				levels={choice.levels}
				bind:start={choice.start}
			/>
		{/key}
		{#if choice.song}
			<p class="hint pad">
				Del catálogo de Apple suena el adelanto de 30 segundos que comparte de cada canción.
			</p>
		{/if}
	{:else}
		<div class="tabs" role="tablist">
			<button
				role="tab"
				type="button"
				aria-selected={tab === 'catalog'}
				onclick={() => (tab = 'catalog')}
			>
				Catálogo
			</button>
			<button
				role="tab"
				type="button"
				aria-selected={tab === 'upload'}
				onclick={() => (tab = 'upload')}
			>
				Tu archivo
			</button>
		</div>

		{#if tab === 'catalog'}
			<label class="search">
				<Icon name="search" size={16} />
				<input
					bind:value={query}
					{oninput}
					onkeydown={(event) => event.key === 'Enter' && search()}
					type="search"
					placeholder="Busca una canción o un artista"
					aria-label="Busca una canción o un artista"
					enterkeyhint="search"
				/>
				{#if searching}<span class="spinner small"></span>{/if}
			</label>

			{#if problem}
				<p class="error pad">{problem}</p>
			{:else if searched && results.length === 0 && !searching}
				<p class="hint pad">Nada para «{searched}».</p>
			{:else if !searched}
				<p class="hint pad">
					Canciones del catálogo de Apple Music: cada una trae un adelanto de 30 segundos, y de ahí
					eliges el momento.
				</p>
			{/if}

			<ul class="results">
				{#each results as song (song.url)}
					<li>
						<button
							class="row"
							type="button"
							onclick={() => chooseSong(song)}
							disabled={!!preparing}
						>
							{#if song.artwork}
								<img class="art" src={song.artwork} alt="" loading="lazy" />
							{:else}
								<span class="art blank"><Icon name="music" size={20} /></span>
							{/if}
							<span class="names">
								<strong>{song.title}</strong>
								<span>{song.artist}</span>
							</span>
							{#if preparing === song.url}<span class="spinner small"></span>{/if}
						</button>
						<button
							class="listen"
							type="button"
							onclick={() => listen(song)}
							aria-label={listening === song.url ? 'Pausar' : 'Escuchar'}
						>
							<Icon name={listening === song.url ? 'pause' : 'play'} size={16} stroke={3} />
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="upload">
				<span class="circle"><Icon name="music" size={36} stroke={1.6} /></span>
				<p>
					Sube una canción tuya, como MP3. Solo se guarda el momento que elijas, nunca la canción
					entera.
				</p>
				<button class="primary" type="button" onclick={() => picker?.click()} disabled={!!preparing}>
					{#if preparing === 'file'}
						<span class="spinner"></span> Leyendo…
					{:else}
						<Icon name="upload" size={18} /> Elegir canción
					{/if}
				</button>
				{#if problem}<p class="error">{problem}</p>{/if}
				<input
					bind:this={picker}
					type="file"
					accept="audio/mpeg,.mp3,audio/*"
					hidden
					onchange={chooseFile}
				/>
			</div>
		{/if}
	{/if}
</Sheet>

<style>
	.tabs {
		display: flex;
		margin: 0 16px;
		border-bottom: 1px solid var(--border);
	}

	.tabs button {
		flex: 1;
		padding: 12px 0;
		border: 0;
		border-bottom: 1px solid transparent;
		margin-bottom: -1px;
		background: none;
		color: var(--muted);
		font-weight: 600;
	}

	.tabs button[aria-selected='true'] {
		border-bottom-color: var(--text);
		color: var(--text);
	}

	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 12px 16px 4px;
		padding: 0 12px;
		border-radius: 10px;
		background: var(--field);
		color: var(--muted);
	}

	.search input {
		flex: 1;
		min-width: 0;
		padding: 9px 0;
		border: 0;
		outline: none;
		background: none;
		color: var(--text);
		/* Under 16px iOS zooms in on the field. */
		font-size: 16px;
	}

	.spinner.small {
		width: 14px;
		height: 14px;
		border-width: 2px;
	}

	.pad {
		padding: 0 16px;
	}

	.results {
		margin: 0;
		padding: 4px 0;
		list-style: none;
	}

	.results li {
		display: flex;
		align-items: center;
		padding-right: 8px;
	}

	.row {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 12px;
		min-width: 0;
		padding: 8px 16px;
		border: 0;
		background: none;
		text-align: left;
	}

	.art {
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 4px;
		object-fit: cover;
	}

	.art.blank {
		display: grid;
		place-items: center;
		background: var(--field);
		color: var(--muted);
	}

	.art.large {
		width: 64px;
		height: 64px;
	}

	.names {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.names strong,
	.names span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.names span {
		color: var(--muted);
	}

	.names input {
		padding: 4px 0;
		border: 0;
		border-bottom: 1px solid var(--border);
		outline: none;
		background: none;
		font-size: 16px;
	}

	.names input:first-child {
		font-weight: 600;
	}

	.listen {
		display: grid;
		flex: none;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--field);
	}

	.song {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 16px 0;
	}

	.upload {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 40px 24px;
		text-align: center;
	}

	.upload p {
		max-width: 320px;
		margin: 0;
		color: var(--muted);
	}

	.circle {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border: 2px solid var(--text);
		border-radius: 50%;
	}
</style>
