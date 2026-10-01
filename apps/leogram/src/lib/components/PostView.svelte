<script lang="ts">
	// A post as Instagram shows one: who posted it and their song, the photos, the likes, the caption
	// and the comments. It is the same for its author, for someone signed in, and for whoever opened
	// the link with no account at all; liking and commenting are what take an account, and asking
	// for them signed out puts the door up (`onaccount`).
	import { isExpired, session } from '@leo-os/shared';
	import { onDestroy, untrack } from 'svelte';
	import { isCode, linkOf } from '$lib/code';
	import { count, postDate, shortDate } from '$lib/format';
	import { Player } from '$lib/music/player.svelte';
	import {
		addComment,
		like,
		objectUrl,
		readFile,
		readPost,
		removeComment,
		removePost,
		SONG,
		unlike,
		type CommentView,
		type PostView
	} from '$lib/post';
	import { createProfile } from '$lib/profile.svelte';
	import ActionSheet, { type Action } from './ActionSheet.svelte';
	import Avatar from './Avatar.svelte';
	import Carousel from './Carousel.svelte';
	import Icon from './Icon.svelte';

	let {
		code,
		onaccount,
		ondeleted
	}: {
		code: string;
		/** Signed out, a like or a comment asks for an account: the door, wherever it is kept. */
		onaccount?: () => void;
		/** Its author deleted it from here. */
		ondeleted?: () => void;
	} = $props();

	/** Undefined while it is read; null when there is no such post. */
	let post = $state<PostView | null>();
	/** Why it could not be read. */
	let problem = $state('');
	let slides = $state<(string | null)[]>([]);
	let index = $state(0);
	let player = $state<Player>();
	let draft = $state('');
	let sending = $state(false);
	let everyComment = $state(false);
	let fullCaption = $state(false);
	let menu = $state(false);
	let toast = $state('');
	/** Counts double taps, so that each one plays the heart again. */
	let burst = $state(0);
	let field = $state<HTMLTextAreaElement>();

	/** What was asked for signed out, to be done once signed in and the post read again. */
	let pending: 'like' | 'comment' | undefined;
	/** The post whose files are on screen. */
	let filesOf = '';
	/** Object URLs made here, given back when the post closes. */
	const made: string[] = [];
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	// Read again whenever whoever is looking changes: signing in brings back their like and their
	// name, which a visitor's reading of it could not know.
	$effect(() => {
		const current = code;
		if (session.status === 'checking') return;
		untrack(() => read(current));
	});

	onDestroy(() => {
		player?.destroy();
		clearTimeout(toastTimer);
		for (const url of made) URL.revokeObjectURL(url);
	});

	function message(thrown: unknown, fallback: string): string {
		return thrown instanceof Error && thrown.message ? thrown.message : fallback;
	}

	async function read(current: string) {
		// No code is shaped like that: there is nothing to ask the database.
		if (!isCode(current)) {
			post = null;
			return;
		}
		try {
			const found = await readPost(current);
			if (current !== code) return;
			post = found;
			problem = '';
			if (!found) return;
			if (filesOf !== current) loadFiles(found);
			if (pending && session.status === 'in') {
				const action = pending;
				pending = undefined;
				if (action === 'like' && !found.liked) toggleLike();
				if (action === 'comment') field?.focus();
			}
		} catch (thrown) {
			if (current !== code) return;
			// A session that ran out: signed out, the post is read again as a visitor.
			if (isExpired(thrown) && session.status === 'in') session.expire();
			else problem = message(thrown, 'No se pudo abrir la publicación.');
		}
	}

	/**
	 * The photos one by one, the first before any other so that something shows soon, and the
	 * song's clip right after it. A catalog song needs nothing read: it plays from Apple.
	 */
	async function loadFiles(found: PostView) {
		filesOf = found.id;
		player?.destroy();
		player = undefined;
		slides = Array.from({ length: found.slides }, () => null);

		const music = found.music;
		if (music?.source === 'catalog') play(music.url, music.start, music.length);

		const fetchSlot = async (slot: number) => {
			const url = await readFile(found.id, slot).catch(() => null);
			if (filesOf !== found.id || !url) return;
			if (slot !== SONG) {
				slides[slot] = url;
			} else if (music) {
				const src = await objectUrl(url);
				made.push(src);
				play(src, music.start, music.length);
			}
		};

		await fetchSlot(0);
		const rest = [...(music?.source === 'upload' ? [SONG] : [])];
		for (let slot = 1; slot < found.slides; slot++) rest.push(slot);
		// Three at a time: fast, without one post taking all of a slow connection.
		await Promise.all(
			Array.from({ length: 3 }, async () => {
				for (let slot = rest.shift(); slot !== undefined; slot = rest.shift()) await fetchSlot(slot);
			})
		);
	}

	function play(src: string, start: number, length: number) {
		player?.destroy();
		player = new Player(src, start, length);
		player.play();
	}

	function say(text: string) {
		toast = text;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 2400);
	}

	function fail(thrown: unknown, fallback: string) {
		if (isExpired(thrown)) {
			session.expire();
			say('La sesión caducó. Vuelve a entrar.');
		} else {
			say(message(thrown, fallback));
		}
	}

	/** Whether there is an account to like or comment with; if not, the door goes up. */
	function signedIn(action: 'like' | 'comment'): boolean {
		if (session.status === 'in' && session.account) return true;
		pending = action;
		onaccount?.();
		return false;
	}

	async function toggleLike() {
		if (!post || !signedIn('like')) return;
		const shown = post;
		const userId = session.account!.id;
		const liked = !shown.liked;
		shown.liked = liked;
		shown.likes += liked ? 1 : -1;
		try {
			await (liked ? like(shown.id, userId) : unlike(shown.id, userId));
		} catch (thrown) {
			shown.liked = !liked;
			shown.likes += liked ? -1 : 1;
			fail(thrown, 'No se pudo guardar el «Me gusta».');
		}
	}

	function doubleTap() {
		if (!post || !signedIn('like')) return;
		burst++;
		if (!post.liked) toggleLike();
	}

	function comment() {
		if (signedIn('comment')) field?.focus();
	}

	async function send(event: SubmitEvent) {
		event.preventDefault();
		const text = draft.trim();
		if (!post || !text || sending || !signedIn('comment')) return;

		const shown = post;
		sending = true;
		try {
			const account = session.account!;
			// The first comment of an account with no profile yet makes it one, out of its name.
			shown.me ??= await createProfile(account.name, account.email);
			shown.comments = [...shown.comments, await addComment(shown.id, shown.me, text)];
			draft = '';
		} catch (thrown) {
			fail(thrown, 'No se pudo publicar el comentario.');
		} finally {
			sending = false;
		}
	}

	function onkeydown(event: KeyboardEvent) {
		// Enter publishes, as on Instagram; Shift+Enter is a new line.
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	}

	async function deleteComment(target: CommentView) {
		if (!post) return;
		const shown = post;
		const before = shown.comments;
		shown.comments = before.filter((comment) => comment.id !== target.id);
		try {
			await removeComment(target.id);
		} catch (thrown) {
			shown.comments = before;
			fail(thrown, 'No se pudo eliminar el comentario.');
		}
	}

	async function copyLink() {
		if (!post) return;
		try {
			await navigator.clipboard.writeText(linkOf(post.id));
			say('Enlace copiado');
		} catch {
			say('No se pudo copiar el enlace');
		}
	}

	async function share() {
		if (!post) return;
		if (!navigator.share) return copyLink();
		try {
			await navigator.share({ title: 'Leogram', url: linkOf(post.id) });
		} catch {
			// Closed without sharing.
		}
	}

	async function deletePost() {
		if (!post) return;
		if (!confirm('¿Eliminar esta publicación? Quien tenga el enlace ya no podrá verla.')) return;
		try {
			await removePost(post.id);
			player?.destroy();
			player = undefined;
			ondeleted?.();
		} catch (thrown) {
			fail(thrown, 'No se pudo eliminar la publicación.');
		}
	}

	const actions = $derived.by(() => {
		const list: Action[] = [{ label: 'Copiar enlace', run: copyLink }];
		if (typeof navigator !== 'undefined' && 'share' in navigator) {
			list.push({ label: 'Compartir…', run: share });
		}
		if (post?.mine) list.push({ label: 'Eliminar', run: deletePost, danger: true });
		return list;
	});

	/** The caption cut short, as Instagram shows a long one until «más» is tapped. */
	const caption = $derived.by(() => {
		const text = post?.caption ?? '';
		const lines = text.split('\n');
		if (fullCaption || (text.length <= 125 && lines.length <= 2)) return { text, cut: false };
		return { text: lines.slice(0, 2).join('\n').slice(0, 125).trimEnd(), cut: true };
	});

	const shownComments = $derived(
		!post ? [] : everyComment || post.comments.length <= 2 ? post.comments : post.comments.slice(-2)
	);
</script>

{#if problem}
	<div class="unavailable">
		<h2>No se pudo abrir la publicación</h2>
		<p>{problem}</p>
		<button class="secondary" type="button" onclick={() => read(code)}>Reintentar</button>
	</div>
{:else if post === null}
	<div class="unavailable">
		<h2>Esta publicación no está disponible</h2>
		<p>Es posible que el enlace no funcione o que se haya eliminado la publicación.</p>
	</div>
{:else if post === undefined}
	<div class="post loading" aria-busy="true" aria-label="Cargando la publicación">
		<header>
			<span class="bone round"></span>
			<span class="bone line"></span>
		</header>
		<div class="bone photo"></div>
	</div>
{:else}
	<article class="post" aria-label="Publicación de {post.username}">
		<header>
			<Avatar src={post.avatars[post.username]} username={post.username} />
			<div class="who">
				<span class="username">{post.username}</span>
				{#if post.music}
					<button class="song" type="button" onclick={() => player?.toggle()}>
						<Icon name="music" size={11} stroke={2.5} />
						<span>{[post.music.artist, post.music.title].filter(Boolean).join(' · ')}</span>
					</button>
				{/if}
			</div>
			<button class="icon-button" type="button" onclick={() => (menu = true)} aria-label="Más opciones">
				<Icon name="more" />
			</button>
		</header>

		<Carousel count={post.slides} aspect={post.aspect} bind:index ondoubletap={doubleTap}>
			{#snippet slide(i)}
				{#if slides[i]}
					<img class="photo" src={slides[i]} alt="Foto {i + 1} de {post?.slides}" draggable="false" />
				{:else}
					<span class="bone fill" aria-hidden="true"></span>
				{/if}
			{/snippet}
			{#snippet overlay()}
				{#key burst}
					{#if burst}
						<span class="burst" aria-hidden="true"><Icon name="liked" size={96} /></span>
					{/if}
				{/key}
				{#if player}
					{#if player.waiting}
						<span class="tap" aria-hidden="true">Toca para escuchar</span>
					{/if}
					<button
						class="sound"
						type="button"
						onclick={(event) => {
							// Not a tap on the photo: two of these are no like.
							event.stopPropagation();
							player?.toggle();
						}}
						aria-label={player.playing ? 'Silenciar la música' : 'Escuchar la música'}
					>
						<Icon name={player.playing ? 'sound' : 'muted'} size={12} stroke={2.4} />
					</button>
				{/if}
			{/snippet}
		</Carousel>

		<div class="bar">
			<button
				class="icon-button heart"
				class:liked={post.liked}
				type="button"
				onclick={toggleLike}
				aria-pressed={post.liked}
				aria-label="Me gusta"
			>
				<Icon name={post.liked ? 'liked' : 'heart'} />
			</button>
			<button class="icon-button" type="button" onclick={comment} aria-label="Comentar">
				<Icon name="comment" />
			</button>
			<button class="icon-button" type="button" onclick={share} aria-label="Compartir">
				<Icon name="share" />
			</button>
			{#if post.slides > 1}
				<div class="dots" aria-hidden="true">
					{#each Array.from({ length: post.slides }, (_, i) => i) as i (i)}
						<span class:current={i === index}></span>
					{/each}
				</div>
			{/if}
		</div>

		<div class="details">
			{#if post.likes > 0}
				<p class="likes">{count(post.likes)} Me gusta</p>
			{:else}
				<button class="likes first" type="button" onclick={toggleLike}>
					Sé el primero en indicar que te gusta
				</button>
			{/if}

			{#if post.caption}
				<p class="caption">
					<span class="username">{post.username}</span>
					{caption.text}{#if caption.cut}…
						<button class="more" type="button" onclick={() => (fullCaption = true)}>más</button>
					{/if}
				</p>
			{/if}

			{#if shownComments.length < post.comments.length}
				<button class="all-comments" type="button" onclick={() => (everyComment = true)}>
					Ver los {count(post.comments.length)} comentarios
				</button>
			{/if}

			{#if shownComments.length > 0}
				<ul class="comments">
					{#each shownComments as item (item.id)}
						<li>
							<Avatar src={post.avatars[item.username]} username={item.username} size={24} />
							<div>
								<p><span class="username">{item.username}</span> {item.text}</p>
								<p class="meta">
									<time datetime={new Date(item.created_at).toISOString()}>
										{shortDate(item.created_at)}
									</time>
									{#if item.mine || post.mine}
										<button type="button" onclick={() => deleteComment(item)}>
											Eliminar
										</button>
									{/if}
								</p>
							</div>
						</li>
					{/each}
				</ul>
			{/if}

			<time class="date" datetime={new Date(post.created_at).toISOString()}>
				{postDate(post.created_at)}
			</time>
		</div>

		<form class="reply" onsubmit={send}>
			{#if session.status === 'in'}
				<Avatar src={post.me ? post.avatars[post.me] : ''} username={post.me ?? ''} size={28} />
				<textarea
					bind:this={field}
					bind:value={draft}
					{onkeydown}
					rows="1"
					maxlength="2200"
					placeholder="Agrega un comentario…"
					aria-label="Agrega un comentario"
				></textarea>
				<button class="publish" type="submit" disabled={!draft.trim() || sending}>
					{sending ? 'Publicando…' : 'Publicar'}
				</button>
			{:else}
				<button class="ask" type="button" onclick={comment}>Agrega un comentario…</button>
			{/if}
		</form>
	</article>

	<ActionSheet bind:open={menu} {actions} />
{/if}

{#if toast}
	<p class="toast" role="status">{toast}</p>
{/if}

<style>
	.post {
		width: 100%;
		max-width: 470px;
		margin: 0 auto;
		background: var(--bg);
	}

	@media (min-width: 520px) {
		.post {
			margin: 16px auto;
			overflow: hidden;
			border: 1px solid var(--border);
			border-radius: 8px;
		}
	}

	header {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 56px;
		padding: 8px 4px 8px 12px;
	}

	.who {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.username {
		font-weight: 600;
	}

	.song {
		display: flex;
		align-items: center;
		gap: 4px;
		max-width: 100%;
		padding: 0;
		border: 0;
		background: none;
		font-size: 12px;
		line-height: 16px;
		text-align: left;
	}

	.song span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.photo {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		-webkit-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
	}

	/* The heart a double tap leaves on the photo. */
	.burst {
		display: grid;
		position: absolute;
		inset: 0;
		place-items: center;
		color: #fff;
		filter: drop-shadow(0 0 16px rgb(0 0 0 / 0.25));
		pointer-events: none;
		animation: burst 0.9s ease-out forwards;
	}

	@keyframes burst {
		0% {
			transform: scale(0.2);
			opacity: 0;
		}
		15% {
			transform: scale(1.15);
			opacity: 0.95;
		}
		30% {
			transform: scale(0.95);
		}
		45%,
		75% {
			transform: scale(1);
			opacity: 0.95;
		}
		100% {
			transform: scale(0.6) translateY(-24px);
			opacity: 0;
		}
	}

	.sound {
		display: grid;
		position: absolute;
		right: 12px;
		bottom: 12px;
		place-items: center;
		width: 28px;
		height: 28px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: rgb(38 38 38 / 0.85);
		color: #fff;
	}

	.tap {
		position: absolute;
		right: 46px;
		bottom: 14px;
		padding: 4px 10px;
		border-radius: 12px;
		background: rgb(38 38 38 / 0.85);
		color: #fff;
		font-size: 12px;
		font-weight: 600;
		pointer-events: none;
		animation: fade-in 0.3s ease-out;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	.bar {
		display: flex;
		position: relative;
		align-items: center;
		min-height: 46px;
		padding: 2px 4px;
	}

	.heart.liked {
		color: var(--like);
		animation: pop 0.35s ease-out;
	}

	@keyframes pop {
		50% {
			transform: scale(1.2);
		}
	}

	.dots {
		display: flex;
		position: absolute;
		left: 50%;
		gap: 4px;
		transform: translateX(-50%);
	}

	.dots span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--muted);
		opacity: 0.4;
	}

	.dots span.current {
		background: var(--blue);
		opacity: 1;
	}

	.details {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 0 12px 12px;
	}

	.details p {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.likes {
		align-self: flex-start;
		padding: 0;
		border: 0;
		background: none;
		font-weight: 600;
		text-align: left;
	}

	.caption {
		white-space: pre-line;
	}

	.more,
	.all-comments {
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
	}

	.all-comments {
		align-self: flex-start;
	}

	.comments {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 2px 0 0;
		padding: 0;
		list-style: none;
	}

	.comments li {
		display: flex;
		gap: 10px;
	}

	.comments li > div {
		flex: 1;
		min-width: 0;
	}

	.comments .meta {
		display: flex;
		gap: 12px;
		margin-top: 2px;
		color: var(--muted);
		font-size: 12px;
	}

	.meta button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: 12px;
		font-weight: 600;
	}

	.date {
		color: var(--muted);
		font-size: 12px;
	}

	.reply {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 52px;
		padding: 8px 12px;
		border-top: 1px solid var(--border);
	}

	.reply textarea {
		flex: 1;
		min-width: 0;
		max-height: 80px;
		padding: 6px 0;
		border: 0;
		outline: none;
		background: none;
		resize: none;
		field-sizing: content;
		/* Under 16px iOS zooms in on the field. */
		font-size: 16px;
		line-height: 20px;
	}

	.reply textarea::placeholder {
		color: var(--muted);
	}

	.publish {
		padding: 4px;
		border: 0;
		background: none;
		color: var(--blue);
		font-weight: 600;
	}

	.publish:disabled {
		opacity: 0.4;
	}

	.ask {
		flex: 1;
		padding: 6px 0;
		border: 0;
		background: none;
		color: var(--muted);
		text-align: left;
	}

	.unavailable {
		max-width: 470px;
		margin: 0 auto;
		padding: 48px 24px;
		text-align: center;
	}

	.unavailable h2 {
		margin: 0 0 12px;
		font-size: 20px;
		line-height: 26px;
	}

	.unavailable p {
		margin: 0 0 20px;
		color: var(--muted);
	}

	.loading header {
		gap: 12px;
	}

	.bone {
		display: block;
		background: var(--placeholder);
	}

	.bone.round {
		width: 32px;
		height: 32px;
		border-radius: 50%;
	}

	.bone.line {
		width: 120px;
		height: 12px;
		border-radius: 6px;
	}

	.bone.photo {
		aspect-ratio: 4 / 5;
	}

	.bone.fill {
		width: 100%;
		height: 100%;
		animation: glow 1.2s ease-in-out infinite alternate;
	}

	@keyframes glow {
		to {
			opacity: 0.6;
		}
	}

	.toast {
		position: fixed;
		z-index: 50;
		bottom: calc(24px + env(safe-area-inset-bottom));
		left: 50%;
		max-width: calc(100% - 32px);
		margin: 0;
		padding: 10px 16px;
		border-radius: 8px;
		background: #262626;
		color: #fff;
		transform: translateX(-50%);
		box-shadow: 0 4px 16px rgb(0 0 0 / 0.25);
	}
</style>
