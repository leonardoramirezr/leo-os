<script lang="ts">
	// An account's bio, `?u=<username>`, for anybody, signed in or not: its photo and username, and
	// the posts it lists there that whoever is looking can open — each one for anybody with its link,
	// and those for some friends only to those friends, which is what signing in shows. A post that
	// is not listed is not here for anyone, not even those it is for: they open it by its link.
	import { eq, isExpired, remove, session, upsert } from '@leo-os/shared';
	import { untrack } from 'svelte';
	import { readBio, type Bio } from '$lib/bio';
	import { bioLink, linkOf } from '$lib/code';
	import Burst from './Burst.svelte';
	import Cover from './Cover.svelte';
	import Grid from './Grid.svelte';
	import Icon from './Icon.svelte';
	import Ticker from './Ticker.svelte';
	import Visitor from './Visitor.svelte';

	let { username }: { username: string } = $props();

	const FAVORITES = 'leogram_favorites';

	/** Undefined while it is read; null when nobody has that username. */
	let bio = $state<Bio | null>();
	/** Why it could not be read. */
	let problem = $state('');
	/** Why the star did not stick. */
	let failed = $state('');
	let door = $state(false);
	let copied = $state(false);

	// Read again whenever whoever is looking changes: signing in can show posts for some friends.
	$effect(() => {
		const current = username;
		if (session.status === 'checking') return;
		untrack(() => read(current));
	});

	async function read(current: string) {
		try {
			const found = await readBio(current);
			if (current !== username) return;
			bio = found;
			problem = '';
		} catch (thrown) {
			if (current !== username) return;
			// A session that ran out: signed out, the bio is read again as a visitor's.
			if (isExpired(thrown) && session.status === 'in') session.expire();
			else problem = thrown instanceof Error && thrown.message ? thrown.message : 'No se pudo abrir.';
		}
	}

	/** Keeps the account among the favourites, to share posts with it in a tap, or stops keeping it. */
	async function toggleFavorite() {
		const account = session.account;
		if (!bio || !account) return;
		const shown = bio;
		const favorite = !shown.favorite;
		shown.favorite = favorite;
		failed = '';
		try {
			const row = { user_id: account.id, friend_id: shown.id };
			if (favorite) await upsert(FAVORITES, row);
			else await remove(FAVORITES, `${eq('user_id', row.user_id)}&${eq('friend_id', row.friend_id)}`);
		} catch (thrown) {
			shown.favorite = !favorite;
			if (isExpired(thrown)) session.expire();
			else failed = thrown instanceof Error && thrown.message ? thrown.message : 'No se pudo guardar.';
		}
	}

	async function share() {
		if (!bio) return;
		const url = bioLink(bio.username);
		if (navigator.share) {
			try {
				await navigator.share({ title: `${bio.username} en Leogram`, url });
			} catch {
				// Closed without sharing.
			}
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard: the link is in the address bar, to be copied by hand.
		}
	}

	/** Whether «Añadir a favoritos» is there too, which leaves «Compartir» only room for one word. */
	const favoring = $derived(session.status === 'in' && !!bio && !bio.mine);

	/** The app itself, where an account's own posts are. */
	const home = $derived(typeof location === 'undefined' ? './' : location.pathname);
</script>

<Visitor bind:door>
	{#if problem}
		<div class="empty-note">
			<h2 class="display">No se pudo abrir la bio</h2>
			<p>{problem}</p>
			<button class="secondary" type="button" onclick={() => read(username)}>Reintentar</button>
		</div>
	{:else if bio === null}
		<div class="empty-note">
			<h2 class="display">Esta página no está disponible</h2>
			<p>
				Es posible que el enlace no funcione o que la cuenta haya cambiado su nombre de usuario.
			</p>
		</div>
	{:else if bio === undefined}
		<div class="profile" aria-busy="true" aria-label="Cargando la bio">
			<section class="loading">
				<span class="lines">
					<span class="bone line"></span>
					<span class="bone line short"></span>
				</span>
				<span class="bone round"></span>
			</section>
		</div>
	{:else}
		<div class="profile">
			<Cover username={bio.username} avatar={bio.avatar ?? ''} posts={bio.posts.length} />

			<div class="buttons">
				{#if bio.mine}
					<a class="secondary" href={home}>Ir a tu perfil</a>
				{:else if session.status === 'in'}
					<button
						class={bio.favorite ? 'secondary wide' : 'primary wide'}
						type="button"
						onclick={toggleFavorite}
						aria-pressed={bio.favorite}
					>
						<Icon name={bio.favorite ? 'starred' : 'star'} size={18} stroke={2.4} />
						{bio.favorite ? 'En favoritos' : 'Añadir a favoritos'}
					</button>
				{/if}
				<button class="secondary" type="button" onclick={share}>
					{copied ? 'Enlace copiado' : favoring ? 'Compartir' : 'Compartir perfil'}
				</button>
			</div>
			{#if failed}<p class="error pad">{failed}</p>{/if}

			<Ticker words="Publicaciones" />

			{#if bio.posts.length > 0}
				<Grid posts={bio.posts} href={linkOf} />
			{:else}
				<div class="empty-note">
					<Burst size={92} tilt={-8}><Icon name="camera" size={34} stroke={2} /></Burst>
					{#if bio.mine}
						<h2 class="display">Tu bio está vacía</h2>
						<p>
							Aquí aparecen las publicaciones que listas en tu bio, para quien pueda verlas: todos, o
							solo los amigos para quienes son.
						</p>
					{:else}
						<h2 class="display">Aún no hay publicaciones</h2>
						<p>
							{#if session.status === 'in'}
								Cuando {bio.username} liste en su bio publicaciones que puedas ver, aparecerán aquí.
							{:else}
								Si {bio.username} compartió alguna publicación contigo, entra con tu cuenta para verla.
							{/if}
						</p>
						{#if session.status === 'out'}
							<button class="primary" type="button" onclick={() => (door = true)}>Entrar</button>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</Visitor>

<style>
	.profile {
		max-width: 935px;
		margin: 0 auto;
	}

	.buttons {
		display: flex;
		gap: 10px;
		padding: 20px 16px 8px;
	}

	.buttons > * {
		flex: 1;
		white-space: nowrap;
	}

	.buttons > .wide {
		flex: 1.4;
	}

	.pad {
		margin: 0;
		padding: 0 16px;
	}

	.loading {
		display: flex;
		align-items: flex-start;
		gap: 16px;
		padding: 24px 16px;
	}

	.lines {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 10px;
	}

	.bone {
		display: block;
		background: var(--placeholder);
	}

	.bone.line {
		width: 100%;
		height: 48px;
		border-radius: 8px;
	}

	.bone.short {
		width: 70%;
	}

	.bone.round {
		width: 110px;
		height: 110px;
		border-radius: 50%;
	}
</style>
