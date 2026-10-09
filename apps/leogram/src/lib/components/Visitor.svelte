<script lang="ts">
	// What a post's link and a bio open, for anybody: Leogram's name on top, and «Entrar» while
	// signed out. Nobody is asked to sign in to see what is there for them; the Leo OS door only comes
	// up when asked for (`door`), over the page, which stays where it was, and «Ahora no» closes it.
	import { Account, configured, HomeButton, session } from '@leo-os/shared';
	import { afterNavigate } from '$app/navigation';
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import Wordmark from './Wordmark.svelte';

	let { door = $bindable(false), children }: { door?: boolean; children: Snippet } = $props();

	/** Whether this was reached from another page of the app, which «Atrás» goes back to. */
	let back = $state(false);

	// Opened straight from a link there is nowhere to go back to; a home screen app has no back
	// button of its own to do it either. The app renders in the browser, so the first page is an
	// `enter` whose `from` is there all the same, with no address in it.
	afterNavigate(({ type }) => (back = type !== 'enter'));

	// Whoever is looking may already be signed in, here or on the home screen.
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
		{#if back}
			<button class="icon-button" type="button" onclick={() => history.back()} aria-label="Atrás">
				<Icon name="back" size={28} />
			</button>
		{/if}
		<a class="brand" href={home} aria-label="Leogram">
			<Wordmark />
		</a>
		{#if session.status === 'out'}
			<button class="primary" type="button" onclick={() => (door = true)}>Entrar</button>
		{/if}
		<HomeButton />
	</header>

	<main>
		{#if configured}
			{@render children()}
		{:else}
			<div class="note">
				<h2>Sin base de datos</h2>
				<p>Esta versión se publicó sin la configuración de Neon, así que no hay publicaciones.</p>
			</div>
		{/if}
	</main>
</div>

{#if door && session.status !== 'in'}
	<!-- The same door as everywhere in Leo OS, over the page, which stays where it was. -->
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
		gap: 4px;
		height: 52px;
		padding: 0 8px 0 16px;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
	}

	header .icon-button {
		margin-left: -12px;
	}

	.brand {
		display: block;
		margin-right: auto;
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
		margin: 0;
		color: var(--muted);
	}

	.door {
		position: fixed;
		z-index: 100;
		inset: 0;
	}
</style>
