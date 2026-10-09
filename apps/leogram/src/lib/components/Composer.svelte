<script lang="ts">
	// «Nueva publicación»: up to ten photos and videos, in one of Instagram's shapes and framed by
	// dragging each one, text written on any of the photos, a caption, a song, and who it is for.
	// «Compartir» publishes it, and its link is ready right away: there is no other step, and nobody
	// finds it but through the link — or the bio, if it is listed there.
	import { HomeButton, isExpired, session } from '@leo-os/shared';
	import { replaceState } from '$app/navigation';
	import { flushSync, onDestroy, onMount } from 'svelte';
	import { linkOf } from '$lib/code';
	import { clock, people } from '$lib/format';
	import {
		ASPECTS,
		closestAspect,
		load,
		MAX_VIDEO,
		readVideo,
		sizeOf,
		videoType,
		type Aspect
	} from '$lib/images';
	import type { Person } from '$lib/people.svelte';
	import type { Audience } from '$lib/post';
	import { MAX_SLIDES, posts, type DraftMusic, type DraftSlide } from '$lib/posts.svelte';
	import { profile } from '$lib/profile.svelte';
	import Avatar from './Avatar.svelte';
	import Burst from './Burst.svelte';
	import Icon from './Icon.svelte';
	import MusicSheet from './MusicSheet.svelte';
	import TextEditor from './TextEditor.svelte';
	import TextLayers from './TextLayers.svelte';
	import VisibilityFields from './VisibilityFields.svelte';

	const SHAPES: { aspect: Aspect; label: string }[] = [
		{ aspect: 'square', label: '1:1' },
		{ aspect: 'portrait', label: '4:5' },
		{ aspect: 'landscape', label: '1.91:1' }
	];

	let slides = $state<DraftSlide[]>([]);
	let aspect = $state<Aspect>('portrait');
	let caption = $state('');
	let music = $state<DraftMusic | null>(null);
	// Every post starts out as every post was before there was a choice: for anybody with its link,
	// and out of the bio.
	let audience = $state<Audience>('link');
	let friends = $state<Person[]>([]);
	let listed = $state(false);
	/** The slide being framed. */
	let current = $state(0);
	let choosingMusic = $state(false);
	/** The photo whose text is being written. */
	let writingOn = $state<DraftSlide>();
	let reading = $state(false);
	/** From 0 to 1 while it is published. */
	let progress = $state<number>();
	let problem = $state('');
	/** Its code, once it is published. */
	let published = $state('');
	let copied = $state(false);

	let picker: HTMLInputElement;
	let frame = $state<HTMLDivElement>();
	let video = $state<HTMLVideoElement>();
	let drag: { x: number; y: number; focusX: number; focusY: number } | undefined;

	// «+» was the tap that asked for photos: the picker opens with the composer. A browser that
	// wants a tap of its own leaves the button on screen.
	onMount(() => picker.click());

	onDestroy(() => {
		for (const item of slides) letGo(item);
		if (music?.upload) URL.revokeObjectURL(music.upload.url);
	});

	// A video being framed plays, without sound, as it will in the post.
	$effect(() => {
		if (!video) return;
		video.muted = true;
		video.play().catch(() => {});
	});

	function letGo(item: DraftSlide) {
		URL.revokeObjectURL(item.preview);
		if (item.thumb !== item.preview) URL.revokeObjectURL(item.thumb);
	}

	/**
	 * A file from the gallery as a slide. A photo is decoded once for its size and let go of: it is
	 * decoded again to be published. A video is read for its size and its first frame.
	 */
	async function read(file: File): Promise<DraftSlide> {
		const focus = { x: 0.5, y: 0.5 };
		const type = videoType(file);
		if (type) {
			if (file.size > MAX_VIDEO) throw new Error('Un video pesa más de 300 MB: elige uno más corto.');
			const { width, height, frame } = await readVideo(file);
			const [preview, thumb] = [URL.createObjectURL(file), URL.createObjectURL(frame)];
			return { kind: 'video', file, type, width, height, frame, preview, thumb, focus, texts: [] };
		}
		if (file.type.startsWith('video/')) {
			throw new Error('Ese video no se puede subir: elige uno en MP4 o MOV.');
		}

		let image: Awaited<ReturnType<typeof load>>;
		try {
			image = await load(file);
		} catch {
			throw new Error('No se pudo leer una de las fotos.');
		}
		const { width, height } = sizeOf(image);
		if ('close' in image) image.close();
		const preview = URL.createObjectURL(file);
		return {
			kind: 'photo',
			file,
			type: 'image/jpeg',
			width,
			height,
			preview,
			thumb: preview,
			focus,
			texts: []
		};
	}

	async function addFiles() {
		const files = [...(picker.files ?? [])].slice(0, MAX_SLIDES - slides.length);
		picker.value = '';
		if (files.length === 0) return;
		reading = true;
		problem = '';
		for (const file of files) {
			try {
				const item = await read(file);
				if (slides.length === 0) aspect = closestAspect(item.width, item.height);
				slides.push(item);
			} catch (thrown) {
				// One that cannot be read is left out; the rest still come.
				problem = thrown instanceof Error ? thrown.message : 'No se pudo leer uno de los archivos.';
			}
		}
		current = Math.min(current, Math.max(0, slides.length - 1));
		reading = false;
	}

	function removeSlide(index: number) {
		const [gone] = slides.splice(index, 1);
		if (gone) letGo(gone);
		current = Math.max(0, Math.min(current, slides.length - 1));
	}

	function move(index: number, by: number) {
		const to = index + by;
		if (to < 0 || to >= slides.length) return;
		const [item] = slides.splice(index, 1);
		slides.splice(to, 0, item);
		current = to;
	}

	/** «Foto 2» or «Video 2». */
	function named(item: DraftSlide, index: number) {
		return `${item.kind === 'video' ? 'Video' : 'Foto'} ${index + 1}`;
	}

	const frameLabel = $derived.by(() => {
		const item = slides[current];
		if (!item) return undefined;
		const drag = item.kind === 'video' ? 'arrástralo para encuadrarlo' : 'arrástrala para encuadrarla';
		return `${named(item, current)} de ${slides.length}: ${drag}`;
	});

	/**
	 * How far the slide reaches past the frame, in pixels across and down: what dragging can move
	 * it by. It covers the frame, so it only overflows one way.
	 */
	function overflow(item: DraftSlide) {
		if (!frame) return { x: 0, y: 0 };
		const ratio = item.width / item.height;
		const box = { width: frame.clientWidth, height: frame.clientHeight };
		return ratio > ASPECTS[aspect]
			? { x: box.height * ratio - box.width, y: 0 }
			: { x: 0, y: box.width / ratio - box.height };
	}

	function onpointerdown(event: PointerEvent) {
		const item = slides[current];
		if (!item || !frame) return;
		frame.setPointerCapture(event.pointerId);
		drag = { x: event.clientX, y: event.clientY, focusX: item.focus.x, focusY: item.focus.y };
	}

	function onpointermove(event: PointerEvent) {
		const item = slides[current];
		if (!drag || !item) return;
		const room = overflow(item);
		const clamp = (value: number) => Math.min(1, Math.max(0, value));
		// The picture follows the finger, so the frame moves the other way.
		if (room.x > 0) item.focus.x = clamp(drag.focusX - (event.clientX - drag.x) / room.x);
		if (room.y > 0) item.focus.y = clamp(drag.focusY - (event.clientY - drag.y) / room.y);
	}

	/** «Aa»: the editor is up within this same tap, which is what lets its field bring up the keyboard. */
	function writeOn(item: DraftSlide) {
		if (item.kind !== 'photo') return;
		writingOn = item;
		flushSync();
	}

	function cancel() {
		const touched = slides.length > 0 || caption.trim() !== '' || music !== null;
		if (touched && !published && !confirm('¿Descartar la publicación?')) return;
		history.back();
	}

	/** Some friends, and nobody picked: the post would be for its author alone. */
	const friendless = $derived(audience === 'friends' && friends.length === 0);

	async function share() {
		if (slides.length === 0 || progress !== undefined || friendless) return;
		problem = '';
		progress = 0;
		try {
			published = await posts.publish(
				{ slides, aspect, caption: caption.trim(), music, audience, listed, friends },
				(done) => (progress = done)
			);
		} catch (thrown) {
			if (isExpired(thrown)) session.expire();
			problem = thrown instanceof Error && thrown.message ? thrown.message : 'No se pudo publicar.';
		} finally {
			progress = undefined;
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(linkOf(published));
			copied = true;
		} catch {
			// No clipboard: the link is on screen, to be selected by hand.
		}
	}

	async function shareLink() {
		if (!navigator.share) return copy();
		try {
			await navigator.share({ title: 'Leogram', url: linkOf(published) });
		} catch {
			// Closed without sharing.
		}
	}
</script>

<div class="screen">
	<header class="masthead">
		{#if published}
			<span class="side"></span>
			<h1 class="display">Publicado</h1>
			<span class="side end">
				<button class="text-button accent" type="button" onclick={() => history.back()}>Listo</button>
				<HomeButton />
			</span>
		{:else}
			<span class="side">
				<button class="text-button" type="button" onclick={cancel} disabled={progress !== undefined}>
					Cancelar
				</button>
			</span>
			<h1 class="display">Nueva publicación</h1>
			<span class="side end">
				<button
					class="text-button accent"
					type="button"
					onclick={share}
					disabled={slides.length === 0 || progress !== undefined || reading || friendless}
				>
					Compartir
				</button>
				<HomeButton />
			</span>
		{/if}
	</header>

	<input bind:this={picker} type="file" accept="image/*,video/*" multiple hidden onchange={addFiles} />

	{#if published}
		<div class="done">
			<Burst size={104} tilt={-8} fill="var(--lime)">
				<Icon name="check" size={40} stroke={3} />
			</Burst>
			<h2 class="display">Tu publicación ya tiene enlace</h2>
			{#if audience === 'friends'}
				<p>
					Solo {people(friends.map((friend) => friend.username))}
					{friends.length === 1 ? 'puede' : 'pueden'} abrirlo, entrando con su cuenta.
					{listed ? 'También aparece en tu bio, pero solo para quien puede abrirla.' : 'No está en tu bio.'}
				</p>
			{:else}
				<p>
					Cualquiera que lo abra la ve, sin cuenta. Para dar «Me gusta» o comentar, tendrá que
					entrar.
					{listed ? 'Además, aparece en tu bio para todos.' : 'No está en tu bio.'}
				</p>
			{/if}
			<a class="link" href={linkOf(published)} target="_blank" rel="noopener">
				{linkOf(published).replace(/^https?:\/\//, '')}
			</a>
			<div class="buttons">
				<button class="primary" type="button" onclick={copy}>
					<Icon name="link" size={18} />
					{copied ? 'Enlace copiado' : 'Copiar enlace'}
				</button>
				<button class="secondary" type="button" onclick={shareLink}>
					<Icon name="share" size={18} /> Compartir
				</button>
				<button class="secondary" type="button" onclick={() => replaceState('', { post: published })}>
					Ver publicación
				</button>
			</div>
		</div>
	{:else if slides.length === 0}
		<div class="empty">
			<Burst size={104} tilt={-8}><Icon name="photo" size={38} stroke={2} /></Burst>
			<h2 class="display">Elige fotos y videos</h2>
			<p>Hasta {MAX_SLIDES}, que se verán en carrusel.</p>
			<button class="primary" type="button" onclick={() => picker.click()} disabled={reading}>
				{reading ? 'Leyendo…' : 'Seleccionar de la galería'}
			</button>
			{#if problem}<p class="error">{problem}</p>{/if}
		</div>
	{:else}
		<div class="editor">
			<div class="framed">
				<div
					class="frame"
					bind:this={frame}
					style:aspect-ratio={ASPECTS[aspect]}
					{onpointerdown}
					{onpointermove}
					onpointerup={() => (drag = undefined)}
					onpointercancel={() => (drag = undefined)}
					role="img"
					aria-label={frameLabel}
				>
					{#if slides[current]}
						{@const item = slides[current]}
						{#if item.kind === 'video'}
							<video
								bind:this={video}
								src={item.preview}
								style:object-position="{item.focus.x * 100}% {item.focus.y * 100}%"
								muted
								loop
								playsinline
							></video>
						{:else}
							<img
								src={item.preview}
								alt=""
								draggable="false"
								style:object-position="{item.focus.x * 100}% {item.focus.y * 100}%"
							/>
							<TextLayers layers={item.texts} />
						{/if}
					{/if}
					{#if slides.length > 1}
						<span class="counter">{current + 1}/{slides.length}</span>
					{/if}
				</div>
				<!-- Beside the frame rather than in it: what is in an image is not read out. -->
				{#if slides[current]?.kind === 'photo'}
					<button
						class="write"
						type="button"
						onclick={() => writeOn(slides[current])}
						aria-label="Escribir en la foto"
					>
						<Icon name="text" size={20} />
					</button>
				{/if}
			</div>

			<div class="tools">
				<div class="shapes" role="radiogroup" aria-label="Forma de las fotos">
					{#each SHAPES as shape (shape.aspect)}
						<button
							type="button"
							role="radio"
							aria-checked={aspect === shape.aspect}
							onclick={() => (aspect = shape.aspect)}
						>
							<Icon name={shape.aspect} size={18} />
							<span>{shape.label}</span>
						</button>
					{/each}
				</div>
				<div class="order">
					<button
						class="icon-button"
						type="button"
						onclick={() => move(current, -1)}
						disabled={current === 0}
						aria-label="Mover antes"
					>
						<Icon name="back" size={20} />
					</button>
					<button
						class="icon-button"
						type="button"
						onclick={() => move(current, 1)}
						disabled={current === slides.length - 1}
						aria-label="Mover después"
					>
						<Icon name="forward" size={20} />
					</button>
					<button
						class="icon-button"
						type="button"
						onclick={() => removeSlide(current)}
						aria-label="Quitar de la publicación"
					>
						<Icon name="trash" size={20} />
					</button>
				</div>
			</div>

			<ul class="thumbs">
				{#each slides as item, i (item.preview)}
					<li>
						<button
							type="button"
							class:current={i === current}
							onclick={() => (current = i)}
							aria-label={named(item, i)}
						>
							<img src={item.thumb} alt="" />
							{#if item.kind === 'video'}
								<span class="kind"><Icon name="video" size={14} /></span>
							{:else if item.texts.length > 0}
								<span class="kind"><Icon name="text" size={14} /></span>
							{/if}
						</button>
					</li>
				{/each}
				{#if slides.length < MAX_SLIDES}
					<li>
						<button
							class="add"
							type="button"
							onclick={() => picker.click()}
							disabled={reading}
							aria-label="Añadir fotos o videos"
						>
							{#if reading}<span class="spinner"></span>{:else}<Icon name="plus" size={22} />{/if}
						</button>
					</li>
				{/if}
			</ul>

			<label class="caption">
				<Avatar src={profile.avatar} username={profile.username} size={32} />
				<textarea
					bind:value={caption}
					maxlength="2200"
					rows="3"
					placeholder="Escribe una descripción…"
				></textarea>
			</label>
			{#if caption.length > 2000}
				<p class="hint right">{caption.length}/2200</p>
			{/if}

			{#if music}
				<div class="music chosen">
					<Icon name="music" size={20} />
					<button class="names" type="button" onclick={() => (choosingMusic = true)}>
						<strong>{music.title}</strong>
						<span>
							{[music.artist, `desde ${clock(music.start)}`].filter(Boolean).join(' · ')}
						</span>
					</button>
					<button
						class="icon-button"
						type="button"
						onclick={() => (music = null)}
						aria-label="Quitar la música"
					>
						<Icon name="close" size={18} />
					</button>
				</div>
			{:else}
				<button class="music" type="button" onclick={() => (choosingMusic = true)}>
					<Icon name="music" size={20} />
					<span>Añadir música</span>
					<Icon name="forward" size={18} />
				</button>
			{/if}

			<VisibilityFields bind:audience bind:friends bind:listed />

			{#if problem}<p class="error pad">{problem}</p>{/if}
		</div>
	{/if}

	{#if progress !== undefined}
		<div class="publishing" role="status">
			<p>Publicando…</p>
			<div class="bar"><span style:width="{Math.round(progress * 100)}%"></span></div>
		</div>
	{/if}
</div>

{#if writingOn}
	<TextEditor
		photo={writingOn.preview}
		focus={writingOn.focus}
		{aspect}
		texts={writingOn.texts}
		ondone={(texts) => {
			if (writingOn) writingOn.texts = texts;
			writingOn = undefined;
		}}
		oncancel={() => (writingOn = undefined)}
	/>
{/if}

<MusicSheet
	bind:open={choosingMusic}
	onpick={(picked) => {
		if (music?.upload && music.upload !== picked.upload) URL.revokeObjectURL(music.upload.url);
		music = picked;
	}}
/>

<style>
	.screen {
		position: fixed;
		z-index: 20;
		inset: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		background: var(--bg);
	}

	header {
		z-index: 5;
		padding-left: 12px;
	}

	/* The title takes what the corners leave, and is centred in that: the right corner holds two
	   things, so centring it on the screen would leave it no room. */
	h1 {
		font-size: 20px;
	}

	.side {
		display: flex;
		flex: none;
		align-items: center;
	}

	.side.end {
		justify-content: flex-end;
		gap: 8px;
	}

	.editor {
		max-width: 470px;
		margin: 0 auto;
		padding-bottom: calc(24px + env(safe-area-inset-bottom));
	}

	.framed {
		position: relative;
	}

	/* The photo being framed: a print on the page, as the post will show it. */
	.frame {
		position: relative;
		width: 100%;
		overflow: hidden;
		border-bottom: 3px solid var(--ink);
		background: var(--placeholder);
		cursor: grab;
		touch-action: none;
		transition: aspect-ratio 0.2s;
	}

	.frame:active {
		cursor: grabbing;
	}

	.frame img,
	.frame video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
		-webkit-user-select: none;
		user-select: none;
	}

	.write {
		display: grid;
		position: absolute;
		bottom: 12px;
		left: 12px;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		background: var(--lilac);
		color: var(--on-lilac);
		box-shadow: 2px 2px 0 var(--ink);
		cursor: pointer;
	}

	.counter {
		position: absolute;
		top: 12px;
		right: 12px;
		padding: 5px 9px 4px;
		border: 2px solid var(--ink);
		border-radius: 999px;
		background: var(--lilac);
		color: var(--on-lilac);
		font: 700 11px/1 var(--mono);
	}

	.tools {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 8px 8px 12px;
	}

	.shapes {
		display: flex;
		gap: 6px;
	}

	.shapes button {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 10px 5px;
		border: 2px solid var(--ink);
		border-radius: 999px;
		background: var(--card);
		color: var(--text);
		font: 700 11px/1 var(--mono);
	}

	.shapes button[aria-checked='true'] {
		background: var(--lilac);
		color: var(--on-lilac);
	}

	.order {
		display: flex;
	}

	.thumbs {
		display: flex;
		gap: 6px;
		margin: 0;
		padding: 0 12px 12px;
		overflow-x: auto;
		list-style: none;
		scrollbar-width: none;
	}

	.thumbs button {
		display: grid;
		position: relative;
		place-items: center;
		width: 56px;
		height: 56px;
		padding: 0;
		overflow: hidden;
		border: 2px solid var(--ink);
		border-radius: 10px;
		background: var(--field);
	}

	/* The one being framed is lifted off the page. */
	.thumbs {
		padding-top: 4px;
	}

	.thumbs button.current {
		box-shadow: 0 0 0 2px var(--accent);
	}

	.thumbs .add {
		border-style: dashed;
		background: none;
	}

	.thumbs img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.thumbs .kind {
		display: grid;
		position: absolute;
		top: 3px;
		right: 3px;
		padding: 2px;
		border: 1.5px solid var(--ink);
		border-radius: 50%;
		background: var(--lilac);
		color: var(--on-lilac);
	}

	.caption {
		display: flex;
		gap: 12px;
		padding: 14px 12px;
		border-top: var(--line) solid var(--ink);
	}

	.caption textarea {
		flex: 1;
		min-height: 72px;
		padding: 6px 0;
		border: 0;
		outline: none;
		background: none;
		resize: none;
		field-sizing: content;
		/* Under 16px iOS zooms in on the field. */
		font-size: 16px;
		line-height: 21px;
	}

	.caption textarea::placeholder {
		color: var(--muted);
	}

	.right {
		padding: 0 12px;
		text-align: right;
	}

	.music {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 52px;
		padding: 8px 12px;
		border: 0;
		border-top: var(--line) solid var(--ink);
		border-bottom: var(--line) solid var(--ink);
		background: none;
		text-align: left;
	}

	.music > span {
		flex: 1;
		font-size: 16px;
		font-weight: 700;
	}

	.music .names {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		text-align: left;
	}

	.names strong,
	.names span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.names span {
		color: var(--muted);
		font-size: 13px;
	}

	.pad {
		padding: 0 12px;
	}

	.empty,
	.done {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		max-width: 420px;
		margin: 0 auto;
		padding: 56px 24px;
		text-align: center;
	}

	.empty h2,
	.done h2 {
		margin: 4px 0 0;
		font-size: 30px;
	}

	.empty p,
	.done p {
		margin: 0;
		color: var(--muted);
	}

	.link {
		max-width: 100%;
		padding: 8px 12px 7px;
		overflow: hidden;
		border: var(--line) solid var(--ink);
		border-radius: 12px;
		background: var(--card);
		color: var(--accent);
		font: 700 13px/1.2 var(--mono);
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.buttons {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
		margin-top: 8px;
	}

	.publishing {
		display: flex;
		position: fixed;
		z-index: 30;
		inset: 0;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: rgb(21 21 28 / 0.7);
		color: #fff;
		font-weight: 800;
	}

	.publishing p {
		margin: 0;
	}

	/* The progress as a lime strip filling an outlined one. */
	.publishing .bar {
		width: min(280px, 70%);
		height: 18px;
		overflow: hidden;
		border: var(--line) solid #15151c;
		border-radius: 9px;
		background: #f2f2ec;
		box-shadow: 4px 4px 0 #15151c;
	}

	.publishing .bar span {
		display: block;
		height: 100%;
		background: var(--lime);
		transition: width 0.2s;
	}
</style>
