<script lang="ts">
	// One of the account's own posts, over its grid: the post as whoever it is for sees it, with its
	// link on top to copy or share, and who it is for, to change, above the post.
	import { HomeButton } from '@leo-os/shared';
	import { linkOf } from '$lib/code';
	import { posts } from '$lib/posts.svelte';
	import Icon from './Icon.svelte';
	import PostView from './PostView.svelte';

	let { code }: { code: string } = $props();

	const link = $derived(linkOf(code));
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard: the link is on screen, to be selected by hand.
		}
	}
</script>

<div class="screen">
	<header class="masthead">
		<button class="icon-button" type="button" onclick={() => history.back()} aria-label="Atrás">
			<Icon name="back" size={28} stroke={2.4} />
		</button>
		<h1 class="display">Publicación</h1>
		<span class="side">
			<HomeButton />
		</span>
	</header>

	<div class="link">
		<Icon name="link" size={18} stroke={2.2} />
		<a href={link} target="_blank" rel="noopener">{link.replace(/^https?:\/\//, '')}</a>
		<button class="secondary" type="button" onclick={copy}>{copied ? 'Copiado' : 'Copiar'}</button>
	</div>

	<PostView
		{code}
		ondeleted={() => {
			posts.forget(code);
			history.back();
		}}
		onshared={(visibility) => posts.reshare(code, visibility)}
	/>
</div>

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
		padding-left: 4px;
	}

	/* As wide as «Atrás», so the title stays centred. */
	.side {
		display: flex;
		justify-content: flex-end;
		width: 44px;
	}

	/* Its link, typed on a label, with «Copiar» at its end. */
	.link {
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 446px;
		margin: 16px 12px 4px;
		padding: 6px 6px 6px 12px;
		border: var(--line) solid var(--ink);
		border-radius: 14px;
		background: var(--card);
	}

	@media (min-width: 470px) {
		.link {
			margin: 16px auto 4px;
		}
	}

	.link a {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		color: var(--accent);
		font: 700 13px/1 var(--mono);
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.link .secondary {
		min-height: 34px;
		padding: 0 12px;
		border-width: 2px;
		border-radius: 10px;
		box-shadow: 2px 2px 0 var(--ink);
		font-size: 14px;
	}
</style>
