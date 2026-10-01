<script lang="ts">
	// The account's profile, as Instagram has it: its photo and username on top, and every post it
	// has published in a grid of three. «+» writes a new one.
	import { pushState } from '$app/navigation';
	import { count } from '$lib/format';
	import { posts } from '$lib/posts.svelte';
	import { profile } from '$lib/profile.svelte';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import ProfileSheet from './ProfileSheet.svelte';
	import Wordmark from './Wordmark.svelte';

	let editing = $state(false);
</script>

<div class="profile">
	<header class="top">
		<Wordmark />
		<button
			class="icon-button"
			type="button"
			onclick={() => pushState('', { composing: true })}
			aria-label="Nueva publicación"
		>
			<Icon name="create" size={26} />
		</button>
	</header>

	<section class="who">
		<Avatar src={profile.avatar} username={profile.username} size={86} ring />
		<div class="side">
			<h1>{profile.username}</h1>
			<p>
				<strong>{count(posts.list.length)}</strong>
				{posts.list.length === 1 ? 'publicación' : 'publicaciones'}
			</p>
		</div>
	</section>

	<div class="buttons">
		<button class="secondary" type="button" onclick={() => (editing = true)}>Editar perfil</button>
	</div>

	<div class="tab" aria-hidden="true"><Icon name="grid" /></div>

	{#if posts.list.length === 0}
		<div class="empty">
			<span class="circle"><Icon name="camera" size={40} stroke={1.5} /></span>
			<h2>Comparte fotos</h2>
			<p>
				Cuando compartas una publicación, aparecerá en tu perfil, con un enlace para que cualquiera la
				vea.
			</p>
			<button class="link" type="button" onclick={() => pushState('', { composing: true })}>
				Comparte tu primera foto
			</button>
		</div>
	{:else}
		<ul class="grid">
			{#each posts.list as post (post.id)}
				<li>
					<button
						type="button"
						onclick={() => pushState('', { post: post.id })}
						aria-label="Abrir la publicación"
					>
						{#if post.thumb}
							<img src={post.thumb} alt="" onerror={(event) => event.currentTarget.remove()} />
						{/if}
						{#if post.slides > 1}
							<span class="badge"><Icon name="carousel" size={20} /></span>
						{:else if post.video}
							<span class="badge"><Icon name="video" size={20} /></span>
						{:else if post.music}
							<span class="badge"><Icon name="music" size={18} stroke={2.4} /></span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<ProfileSheet bind:open={editing} />

<style>
	.profile {
		max-width: 935px;
		min-height: 100dvh;
		margin: 0 auto;
		padding-bottom: env(safe-area-inset-bottom);
	}

	.top {
		display: flex;
		position: sticky;
		z-index: 10;
		top: 0;
		align-items: center;
		justify-content: space-between;
		height: 56px;
		padding: 6px 8px 0 16px;
		background: var(--bg);
	}

	.who {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 12px 16px 0;
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

	.buttons .secondary {
		flex: 1;
	}

	.tab {
		display: flex;
		justify-content: center;
		padding: 10px 0;
		border-top: 1px solid var(--border);
		box-shadow: inset 0 -1px 0 var(--text);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.grid button {
		display: block;
		position: relative;
		width: 100%;
		padding: 0;
		border: 0;
		aspect-ratio: 1;
		background: var(--placeholder);
	}

	.grid img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.badge {
		position: absolute;
		top: 8px;
		right: 8px;
		color: #fff;
		filter: drop-shadow(0 0 2px rgb(0 0 0 / 0.5));
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

	.empty .link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--blue);
		font-weight: 600;
	}
</style>
