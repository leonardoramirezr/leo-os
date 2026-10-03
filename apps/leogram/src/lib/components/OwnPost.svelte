<script lang="ts">
	// One of the account's own posts, over its grid: the post as whoever it is for sees it, with its
	// link on top to copy or share, and who it is for, to change, above the post.
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
	<header>
		<button class="icon-button" type="button" onclick={() => history.back()} aria-label="Atrás">
			<Icon name="back" size={28} />
		</button>
		<h1>Publicación</h1>
		<span class="side"></span>
	</header>

	<div class="link">
		<Icon name="link" size={18} />
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
		display: flex;
		position: sticky;
		z-index: 5;
		top: 0;
		align-items: center;
		height: 52px;
		padding: 0 4px;
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
		width: 44px;
	}

	.link {
		display: flex;
		align-items: center;
		gap: 10px;
		max-width: 470px;
		margin: 12px auto;
		padding: 0 12px;
	}

	.link a {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		color: var(--link);
		text-decoration: none;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
