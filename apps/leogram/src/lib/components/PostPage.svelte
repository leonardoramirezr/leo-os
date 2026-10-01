<script lang="ts">
	// What a post's link opens, for anybody: Leogram's name on top and the post under it. Nobody is
	// asked to sign in to see it; the Leo OS door only comes up to like or comment, and it can be
	// closed again with «Ahora no».
	import { Account, configured, session } from '@leo-os/shared';
	import PostView from './PostView.svelte';
	import Wordmark from './Wordmark.svelte';

	let { code }: { code: string } = $props();

	let door = $state(false);
	let deleted = $state(false);

	// Whoever is looking may already be signed in, here or on the home screen: then a like is theirs.
	if (configured) session.check();

	// Signed in through the door: it has done its job.
	$effect(() => {
		if (session.status === 'in') door = false;
	});

	/** The app itself, where an account's own posts are. */
	const home = $derived(typeof location === 'undefined' ? './' : location.pathname);
</script>

<div class="page">
	<header>
		<a class="brand" href={home} aria-label="Leogram">
			<Wordmark />
		</a>
		{#if session.status === 'out'}
			<button class="primary" type="button" onclick={() => (door = true)}>Entrar</button>
		{/if}
	</header>

	<main>
		{#if !configured}
			<div class="note">
				<h2>Sin base de datos</h2>
				<p>Esta versión se publicó sin la configuración de Neon, así que no hay publicaciones.</p>
			</div>
		{:else if deleted}
			<div class="note">
				<h2>Eliminaste esta publicación</h2>
				<p>Quien tenga el enlace ya no podrá verla.</p>
				<a class="secondary" href={home}>Ir a tu perfil</a>
			</div>
		{:else}
			<PostView {code} onaccount={() => (door = true)} ondeleted={() => (deleted = true)} />
		{/if}
	</main>
</div>

{#if door && session.status !== 'in'}
	<!-- The same door as everywhere in Leo OS, over the post, which stays where it was. -->
	<div class="door">
		<Account oncancel={() => (door = false)}>
			{#snippet children()}{/snippet}
		</Account>
	</div>
{/if}

<style>
	.page {
		min-height: 100dvh;
	}

	header {
		display: flex;
		position: sticky;
		z-index: 10;
		top: 0;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 60px;
		padding: 0 16px;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
	}

	.brand {
		display: block;
		padding-top: 6px;
		color: var(--text);
	}

	header .primary {
		min-height: 32px;
		padding: 0 16px;
	}

	main {
		padding-bottom: env(safe-area-inset-bottom);
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

	.note a {
		text-decoration: none;
	}

	.door {
		position: fixed;
		z-index: 100;
		inset: 0;
	}
</style>
