<script lang="ts">
	// «Nueva publicación»: up to ten photos, cut to one of Instagram's shapes and framed by dragging
	// each one, a caption and a song. «Compartir» publishes it, and its link is ready right away:
	// there is no other step to make it public, and nobody finds it without the link.
	import { isExpired, session } from '@leo-os/shared';
	import { replaceState } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { linkOf } from '$lib/code';
	import { clock } from '$lib/format';
	import { ASPECTS, closestAspect, load, sizeOf, type Aspect } from '$lib/images';
	import { MAX_PHOTOS, posts, type DraftMusic, type DraftPhoto } from '$lib/posts.svelte';
	import { profile } from '$lib/profile.svelte';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import MusicSheet from './MusicSheet.svelte';

	const SHAPES: { aspect: Aspect; label: string }[] = [
		{ aspect: 'square', label: '1:1' },
		{ aspect: 'portrait', label: '4:5' },
		{ aspect: 'landscape', label: '1.91:1' }
	];

	let photos = $state<DraftPhoto[]>([]);
	let aspect = $state<Aspect>('portrait');
	let caption = $state('');
	let music = $state<DraftMusic | null>(null);
	/** The photo being framed. */
	let current = $state(0);
	let choosingMusic = $state(false);
	let reading = $state(false);
	/** From 0 to 1 while it is published. */
	let progress = $state<number>();
	let problem = $state('');
	/** Its code, once it is published. */
	let published = $state('');
	let copied = $state(false);

	let picker: HTMLInputElement;
	let frame = $state<HTMLDivElement>();
	let drag: { x: number; y: number; focusX: number; focusY: number } | undefined;

	// «+» was the tap that asked for photos: the picker opens with the composer. A browser that
	// wants a tap of its own leaves the button on screen.
	onMount(() => picker.click());

	onDestroy(() => {
		for (const photo of photos) URL.revokeObjectURL(photo.preview);
		if (music?.upload) URL.revokeObjectURL(music.upload.url);
	});

	async function addPhotos() {
		const files = [...(picker.files ?? [])].slice(0, MAX_PHOTOS - photos.length);
		picker.value = '';
		if (files.length === 0) return;
		reading = true;
		problem = '';
		try {
			for (const file of files) {
				// Decoded once for its size, and let go of: it is decoded again to be published.
				const image = await load(file);
				const { width, height } = sizeOf(image);
				if ('close' in image) image.close();
				if (photos.length === 0) aspect = closestAspect(width, height);
				const preview = URL.createObjectURL(file);
				photos.push({ file, width, height, preview, focus: { x: 0.5, y: 0.5 } });
			}
			current = Math.min(current, photos.length - 1);
		} catch {
			problem = 'No se pudo leer una de las fotos.';
		} finally {
			reading = false;
		}
	}

	function removePhoto(index: number) {
		const [gone] = photos.splice(index, 1);
		if (gone) URL.revokeObjectURL(gone.preview);
		current = Math.max(0, Math.min(current, photos.length - 1));
	}

	function move(index: number, by: number) {
		const to = index + by;
		if (to < 0 || to >= photos.length) return;
		const [photo] = photos.splice(index, 1);
		photos.splice(to, 0, photo);
		current = to;
	}

	/**
	 * How far the photo reaches past the frame, in pixels across and down: what dragging can move
	 * it by. A photo covers the frame, so it only overflows one way.
	 */
	function overflow(photo: DraftPhoto) {
		if (!frame) return { x: 0, y: 0 };
		const ratio = photo.width / photo.height;
		const box = { width: frame.clientWidth, height: frame.clientHeight };
		return ratio > ASPECTS[aspect]
			? { x: box.height * ratio - box.width, y: 0 }
			: { x: 0, y: box.width / ratio - box.height };
	}

	function onpointerdown(event: PointerEvent) {
		const photo = photos[current];
		if (!photo || !frame) return;
		frame.setPointerCapture(event.pointerId);
		drag = { x: event.clientX, y: event.clientY, focusX: photo.focus.x, focusY: photo.focus.y };
	}

	function onpointermove(event: PointerEvent) {
		const photo = photos[current];
		if (!drag || !photo) return;
		const room = overflow(photo);
		const clamp = (value: number) => Math.min(1, Math.max(0, value));
		// The photo follows the finger, so the frame moves the other way.
		if (room.x > 0) photo.focus.x = clamp(drag.focusX - (event.clientX - drag.x) / room.x);
		if (room.y > 0) photo.focus.y = clamp(drag.focusY - (event.clientY - drag.y) / room.y);
	}

	function cancel() {
		const touched = photos.length > 0 || caption.trim() !== '' || music !== null;
		if (touched && !published && !confirm('¿Descartar la publicación?')) return;
		history.back();
	}

	async function share() {
		if (photos.length === 0 || progress !== undefined) return;
		problem = '';
		progress = 0;
		try {
			published = await posts.publish(
				{ photos, aspect, caption: caption.trim(), music },
				(done, total) => (progress = done / total)
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
	<header>
		{#if published}
			<span class="side"></span>
			<h1>Publicado</h1>
			<button class="text-button blue side end" type="button" onclick={() => history.back()}>
				Listo
			</button>
		{:else}
			<button class="text-button side" type="button" onclick={cancel} disabled={progress !== undefined}>
				Cancelar
			</button>
			<h1>Nueva publicación</h1>
			<button
				class="text-button blue side end"
				type="button"
				onclick={share}
				disabled={photos.length === 0 || progress !== undefined || reading}
			>
				Compartir
			</button>
		{/if}
	</header>

	<input bind:this={picker} type="file" accept="image/*" multiple hidden onchange={addPhotos} />

	{#if published}
		<div class="done">
			<span class="check"><Icon name="check" size={40} stroke={2.4} /></span>
			<h2>Tu publicación ya tiene enlace</h2>
			<p>
				Cualquiera que lo abra la ve, sin cuenta. Para dar «Me gusta» o comentar, tendrá que entrar.
			</p>
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
	{:else if photos.length === 0}
		<div class="empty">
			<span class="circle"><Icon name="photo" size={44} stroke={1.5} /></span>
			<h2>Elige las fotos</h2>
			<p>Hasta {MAX_PHOTOS}, que se verán en carrusel.</p>
			<button class="primary" type="button" onclick={() => picker.click()} disabled={reading}>
				{reading ? 'Leyendo…' : 'Seleccionar de la galería'}
			</button>
			{#if problem}<p class="error">{problem}</p>{/if}
		</div>
	{:else}
		<div class="editor">
			<div
				class="frame"
				bind:this={frame}
				style:aspect-ratio={ASPECTS[aspect]}
				{onpointerdown}
				{onpointermove}
				onpointerup={() => (drag = undefined)}
				onpointercancel={() => (drag = undefined)}
				role="img"
				aria-label="Foto {current + 1} de {photos.length}: arrástrala para encuadrarla"
			>
				{#if photos[current]}
					{@const focus = photos[current].focus}
					<img
						src={photos[current].preview}
						alt=""
						draggable="false"
						style:object-position="{focus.x * 100}% {focus.y * 100}%"
					/>
				{/if}
				{#if photos.length > 1}
					<span class="counter">{current + 1}/{photos.length}</span>
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
						disabled={current === photos.length - 1}
						aria-label="Mover después"
					>
						<Icon name="forward" size={20} />
					</button>
					<button
						class="icon-button"
						type="button"
						onclick={() => removePhoto(current)}
						aria-label="Quitar esta foto"
					>
						<Icon name="trash" size={20} />
					</button>
				</div>
			</div>

			<ul class="thumbs">
				{#each photos as photo, i (photo.preview)}
					<li>
						<button
							type="button"
							class:current={i === current}
							onclick={() => (current = i)}
							aria-label="Foto {i + 1}"
						>
							<img src={photo.preview} alt="" />
						</button>
					</li>
				{/each}
				{#if photos.length < MAX_PHOTOS}
					<li>
						<button
							class="add"
							type="button"
							onclick={() => picker.click()}
							disabled={reading}
							aria-label="Añadir fotos"
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
		display: flex;
		position: sticky;
		z-index: 5;
		top: 0;
		align-items: center;
		height: 52px;
		padding: 0 12px;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
	}

	h1 {
		flex: 1;
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		text-align: center;
	}

	.side {
		width: 96px;
		text-align: left;
	}

	.side.end {
		text-align: right;
	}

	.editor {
		max-width: 470px;
		margin: 0 auto;
		padding-bottom: calc(24px + env(safe-area-inset-bottom));
	}

	.frame {
		position: relative;
		width: 100%;
		overflow: hidden;
		background: var(--placeholder);
		cursor: grab;
		touch-action: none;
		transition: aspect-ratio 0.2s;
	}

	.frame:active {
		cursor: grabbing;
	}

	.frame img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
		-webkit-user-select: none;
		user-select: none;
	}

	.counter {
		position: absolute;
		top: 12px;
		right: 12px;
		padding: 3px 8px;
		border-radius: 12px;
		background: rgb(18 18 18 / 0.7);
		color: #fff;
		font-size: 12px;
		font-weight: 600;
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
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: 16px;
		background: none;
		color: var(--muted);
		font-size: 12px;
		font-weight: 600;
	}

	.shapes button[aria-checked='true'] {
		border-color: var(--text);
		color: var(--text);
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
		place-items: center;
		width: 56px;
		height: 56px;
		padding: 0;
		overflow: hidden;
		border: 2px solid transparent;
		border-radius: 6px;
		background: var(--field);
	}

	.thumbs button.current {
		border-color: var(--blue);
	}

	.thumbs img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.caption {
		display: flex;
		gap: 12px;
		padding: 12px;
		border-top: 1px solid var(--border);
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
		border-top: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
		background: none;
		text-align: left;
	}

	.music > span {
		flex: 1;
		font-size: 16px;
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
		font-size: 20px;
		line-height: 26px;
	}

	.empty p,
	.done p {
		margin: 0;
		color: var(--muted);
	}

	.circle,
	.check {
		display: grid;
		place-items: center;
		width: 88px;
		height: 88px;
		border: 2px solid var(--text);
		border-radius: 50%;
	}

	.check {
		border: 0;
		background: var(--gradient);
		color: #fff;
	}

	.link {
		max-width: 100%;
		overflow: hidden;
		color: var(--link);
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.buttons {
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
		margin-top: 8px;
	}

	.buttons .secondary {
		min-height: 44px;
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
		background: rgb(0 0 0 / 0.6);
		color: #fff;
		font-weight: 600;
	}

	.publishing p {
		margin: 0;
	}

	.publishing .bar {
		width: min(280px, 70%);
		height: 4px;
		overflow: hidden;
		border-radius: 2px;
		background: rgb(255 255 255 / 0.3);
	}

	.publishing .bar span {
		display: block;
		height: 100%;
		background: #fff;
		transition: width 0.2s;
	}
</style>
