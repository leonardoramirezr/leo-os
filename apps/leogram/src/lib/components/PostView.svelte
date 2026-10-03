<script lang="ts">
	// A post as Instagram shows one: who posted it and their song, the photos and videos, the likes,
	// the caption and the comments. It is the same for its author, for someone signed in, and for
	// whoever opened the link with no account at all; liking and commenting are what take an
	// account, and asking for them signed out puts the door up (`onaccount`). A post for some friends
	// only shows to them, signed in, and to anyone else says only that much. Its files come straight
	// from the bucket, at the addresses the database signed for them.
	import { isExpired, session } from '@leo-os/shared';
	import { onDestroy, untrack } from 'svelte';
	import { bioLink, isCode, linkOf } from '$lib/code';
	import { count, people, postDate, shortDate } from '$lib/format';
	import { Player } from '$lib/music/player.svelte';
	import {
		addComment,
		deletePost,
		like,
		readPost,
		removeComment,
		unlike,
		type CommentView,
		type PostView,
		type Visibility
	} from '$lib/post';
	import { createProfile } from '$lib/profile.svelte';
	import ActionSheet, { type Action } from './ActionSheet.svelte';
	import Avatar from './Avatar.svelte';
	import Carousel from './Carousel.svelte';
	import Icon from './Icon.svelte';
	import VisibilitySheet from './VisibilitySheet.svelte';

	let {
		code,
		onaccount,
		ondeleted,
		onshared
	}: {
		code: string;
		/**
		 * Signed out, a like or a comment asks for an account, and so does a post for some friends:
		 * the door, wherever it is kept.
		 */
		onaccount?: () => void;
		/** Its author deleted it from here. */
		ondeleted?: () => void;
		/** Its author changed who it is for from here. */
		onshared?: (visibility: Visibility) => void;
	} = $props();

	/** Undefined while it is read; null when there is no such post, or not for whoever is looking. */
	let post = $state<PostView | null>();
	/** It is there, for some friends only, and whoever is looking is not one of them, or not yet. */
	let restricted = $state(false);
	/** Its author is changing who it is for. */
	let sharing = $state(false);
	/** Why it could not be read. */
	let problem = $state('');
	let index = $state(0);
	let player = $state<Player>();
	/** The carousel's videos, by slot. */
	let videos = $state<HTMLVideoElement[]>([]);
	/** Whether the videos play with their sound: only once asked for, and never over a song. */
	let videoSound = $state(false);
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
	/** The post whose song is playing. */
	let musicOf = '';
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
	});

	// The video showing plays, from where it was, and the others wait. Without sound until it is
	// asked for, which is also what lets it start on its own.
	$effect(() => {
		const sound = videoSound && !post?.music;
		for (const [slot, video] of videos.entries()) {
			if (!video) continue;
			video.muted = !sound;
			if (slot === index) video.play().catch(() => {});
			else video.pause();
		}
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
			const answer = await readPost(current);
			if (current !== code) return;
			restricted = answer !== null && 'restricted' in answer;
			const found = answer && !('restricted' in answer) ? answer : null;
			post = found;
			problem = '';
			if (!found) return;
			if (musicOf !== found.id) startMusic(found);
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

	/** The song, from its moment: Apple's preview of a catalog song, or the clip in the bucket. */
	function startMusic(found: PostView) {
		musicOf = found.id;
		player?.destroy();
		player = undefined;
		const music = found.music;
		const src = music?.source === 'catalog' ? music.url : found.song;
		if (!music || !src) return;
		player = new Player(src, music.start, music.length);
		player.play();
	}

	function toggleVideoSound() {
		videoSound = !videoSound;
		// Right here, within the tap: Safari only lets a video sound when asked from one.
		const video = videos[index];
		if (!video) return;
		video.muted = !videoSound;
		video.play().catch(() => {});
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

	async function confirmDelete() {
		if (!post) return;
		if (!confirm('¿Eliminar esta publicación? Quien tenga el enlace ya no podrá verla.')) return;
		try {
			await deletePost(post.id);
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
		if (post?.mine) {
			list.push({ label: 'Cambiar quién la ve', run: () => (sharing = true) });
			list.push({ label: 'Eliminar', run: confirmDelete, danger: true });
		}
		return list;
	});

	/** Who it is for, as its author last saved it. */
	const visibility = $derived<Visibility>({
		audience: post?.audience ?? 'link',
		listed: post?.listed ?? false,
		friends: post?.friends ?? []
	});

	/** What its author is told above it: who it is for, and whether the bio lists it. */
	const forWhom = $derived(
		visibility.audience === 'friends'
			? `Solo para ${people(visibility.friends.map((friend) => friend.username))}`
			: 'Cualquiera con el enlace'
	);

	function reshared(chosen: Visibility) {
		if (post) {
			post.audience = chosen.audience;
			post.listed = chosen.listed;
			post.friends = chosen.friends;
		}
		onshared?.(chosen);
	}

	/** The caption cut short, as Instagram shows a long one until «más» is tapped. */
	const caption = $derived.by(() => {
		const text = post?.caption ?? '';
		const lines = text.split('\n');
		if (fullCaption || (text.length <= 125 && lines.length <= 2)) return { text, cut: false };
		return { text: lines.slice(0, 2).join('\n').slice(0, 125).trimEnd(), cut: true };
	});

	/** The photo or video at each place of the carousel; a file that never got there leaves a gap. */
	const items = $derived(new Map(post?.items.map((item) => [item.slot, item]) ?? []));
	const showingVideo = $derived(items.get(index)?.kind === 'video');

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
{:else if restricted}
	<div class="unavailable">
		<span class="lock"><Icon name="lock" size={36} stroke={1.6} /></span>
		<h2>Esta publicación es solo para algunos amigos</h2>
		{#if session.status === 'in'}
			<p>Quien la publicó no la compartió con esta cuenta.</p>
		{:else}
			<p>Si la compartieron contigo, entra con tu cuenta para verla.</p>
			{#if onaccount}
				<button class="primary" type="button" onclick={onaccount}>Entrar</button>
			{/if}
		{/if}
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
		{#if post.mine}
			<button class="audience" type="button" onclick={() => (sharing = true)}>
				<Icon name={visibility.audience === 'friends' ? 'friends' : 'link'} size={18} />
				<span class="summary">
					{forWhom} · {visibility.listed ? 'En tu bio' : 'Fuera de tu bio'}
				</span>
				<span class="change">Cambiar</span>
			</button>
		{/if}
		<header>
			<a class="face" href={bioLink(post.username)} aria-label="Bio de {post.username}">
				<Avatar src={post.avatars[post.username]} username={post.username} />
			</a>
			<div class="who">
				<span class="name">
					<a class="username" href={bioLink(post.username)}>{post.username}</a>
					{#if post.audience === 'friends'}
						<span class="friends" title="Solo para algunos amigos">
							<Icon name="friends" size={12} stroke={2.6} />
							Amigos
						</span>
					{/if}
				</span>
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
				{@const item = items.get(i)}
				{#if item?.kind === 'video'}
					<!-- Framed as its author framed it: the file is the whole video, as recorded. -->
					<video
						class="photo"
						bind:this={videos[i]}
						src={item.url}
						poster={item.poster ?? undefined}
						style:object-position="{item.focus_x}% {item.focus_y}%"
						muted
						loop
						playsinline
						preload={i === index ? 'auto' : 'metadata'}
						aria-label="Video {i + 1} de {post?.slides}"
					></video>
				{:else if item}
					<img class="photo" src={item.url} alt="Foto {i + 1} de {post?.slides}" draggable={false} />
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
				{:else if showingVideo}
					<button
						class="sound"
						type="button"
						onclick={(event) => {
							event.stopPropagation();
							toggleVideoSound();
						}}
						aria-label={videoSound ? 'Silenciar el video' : 'Escuchar el video'}
					>
						<Icon name={videoSound ? 'sound' : 'muted'} size={12} stroke={2.4} />
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
					<a class="username" href={bioLink(post.username)}>{post.username}</a>
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
							<a class="face" href={bioLink(item.username)} aria-label="Bio de {item.username}">
								<Avatar src={post.avatars[item.username]} username={item.username} size={24} />
							</a>
							<div>
								<p>
									<a class="username" href={bioLink(item.username)}>{item.username}</a>
									{item.text}
								</p>
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
	{#if post.mine}
		<VisibilitySheet bind:open={sharing} code={post.id} current={visibility} onsaved={reshared} />
	{/if}
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
		color: inherit;
		font-weight: 600;
		text-decoration: none;
	}

	.face {
		display: block;
		flex: none;
		border-radius: 50%;
		color: inherit;
		text-decoration: none;
	}

	.name {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.name .username {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Instagram marks a post for close friends by its author's name; this is the same idea. */
	.friends {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 3px;
		padding: 1px 7px 1px 5px;
		border-radius: 10px;
		background: #1db954;
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		line-height: 16px;
	}

	/* What only its author sees: who it is for, with «Cambiar» at hand. */
	.audience {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 40px;
		padding: 8px 12px;
		border: 0;
		border-bottom: 1px solid var(--border);
		background: var(--field);
		font-size: 13px;
		text-align: left;
	}

	.audience .summary {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.audience .change {
		color: var(--blue);
		font-weight: 600;
	}

	.lock {
		display: inline-grid;
		place-items: center;
		width: 72px;
		height: 72px;
		margin-bottom: 16px;
		border: 2px solid var(--text);
		border-radius: 50%;
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
