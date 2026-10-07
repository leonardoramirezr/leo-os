<script lang="ts">
	// An account's bio, `?u=<username>`, for anybody, signed in or not: its photo and username, and
	// the posts it lists there that whoever is looking can open — each one for anybody with its link,
	// and those for some friends only to those friends, which is what signing in shows. A post that
	// is not listed is not here for anyone, not even those it is for: they open it by its link.
	import { eq, isExpired, remove, session, upsert } from '@leo-os/shared';
	import { untrack } from 'svelte';
	import { readBio, type Bio } from '$lib/bio';
	import { bioLink, linkOf } from '$lib/code';
	import { count } from '$lib/format';
	import Avatar from './Avatar.svelte';
	import Grid from './Grid.svelte';
	import Icon from './Icon.svelte';
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

	/** The app itself, where an account's own posts are. */
	const home = $derived(typeof location === 'undefined' ? './' : location.pathname);
</script>

<Visitor bind:door>
	{#if problem}
		<div class="note">
			<h2>No se pudo abrir la bio</h2>
			<p>{problem}</p>
			<button class="secondary" type="button" onclick={() => read(username)}>Reintentar</button>
		</div>
	{:else if bio === null}
		<div class="note">
			<h2>Esta página no está disponible</h2>
			<p>
				Es posible que el enlace no funcione o que la cuenta haya cambiado su nombre de usuario.
			</p>
		</div>
	{:else if bio === undefined}
		<div class="profile" aria-busy="true" aria-label="Cargando la bio">
			<section class="who">
				<span class="bone round"></span>
				<span class="bone line"></span>
			</section>
		</div>
	{:else}
		<div class="profile">
			<section class="who">
				<Avatar src={bio.avatar ?? ''} username={bio.username} size={86} ring />
				<div class="side">
					<h1>{bio.username}</h1>
					<p>
						<strong>{count(bio.posts.length)}</strong>
						{bio.posts.length === 1 ? 'publicación' : 'publicaciones'}
					</p>
				</div>
			</section>

			<div class="buttons">
				{#if bio.mine}
					<a class="secondary" href={home}>Ir a tu perfil</a>
				{:else if session.status === 'in'}
					<button
						class={bio.favorite ? 'secondary' : 'primary'}
						type="button"
						onclick={toggleFavorite}
						aria-pressed={bio.favorite}
					>
						<Icon name={bio.favorite ? 'starred' : 'star'} size={16} />
						{bio.favorite ? 'En favoritos' : 'Añadir a favoritos'}
					</button>
				{/if}
				<button class="secondary" type="button" onclick={share}>
					{copied ? 'Enlace copiado' : 'Compartir perfil'}
				</button>
			</div>
			{#if failed}<p class="error pad">{failed}</p>{/if}

			<div class="tab" aria-hidden="true"><Icon name="grid" /></div>

			{#if bio.posts.length > 0}
				<Grid posts={bio.posts} href={linkOf} />
			{:else}
				<div class="empty">
					<span class="circle"><Icon name="camera" size={40} stroke={1.5} /></span>
					{#if bio.mine}
						<h2>Tu bio está vacía</h2>
						<p>
							Aquí aparecen las publicaciones que listas en tu bio, para quien pueda verlas: todos, o
							solo los amigos para quienes son.
						</p>
					{:else}
						<h2>Aún no hay publicaciones</h2>
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

	.who {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 16px 16px 0;
	}

	.side {
		min-width: 0;
	}

	h1 {
		margin: 0 0 6px;
		overflow: hidden;
		font-size: 20px;
		font-weight: 600;
		line-height: 25px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.side p {
		margin: 0;
		font-size: 15px;
	}

	.buttons {
		display: flex;
		gap: 8px;
		padding: 16px;
	}

	.buttons > * {
		flex: 1;
		min-height: 34px;
		text-decoration: none;
	}

	.pad {
		margin: -8px 0 8px;
		padding: 0 16px;
	}

	.tab {
		display: flex;
		justify-content: center;
		padding: 10px 0;
		border-top: 1px solid var(--border);
		box-shadow: inset 0 -1px 0 var(--text);
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px 32px;
		text-align: center;
	}

	.circle {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border: 2px solid var(--text);
		border-radius: 50%;
	}

	.empty h2 {
		margin: 4px 0 0;
		font-size: 24px;
		font-weight: 800;
		line-height: 30px;
	}

	.empty p {
		max-width: 340px;
		margin: 0;
		color: var(--muted);
	}

	.note {
		max-width: 470px;
		margin: 0 auto;
		padding: 48px 24px;
		text-align: center;
	}

	.note h2 {
		margin: 0 0 12px;
		font-size: 20px;
		line-height: 26px;
	}

	.note p {
		margin: 0 0 20px;
		color: var(--muted);
	}

	.bone {
		display: block;
		background: var(--placeholder);
	}

	.bone.round {
		width: 86px;
		height: 86px;
		border-radius: 50%;
	}

	.bone.line {
		width: 140px;
		height: 16px;
		border-radius: 8px;
	}
</style>
