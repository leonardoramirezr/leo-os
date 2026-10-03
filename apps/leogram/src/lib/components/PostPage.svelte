<script lang="ts">
	// What a post's link opens: the post, for whoever it is for — anybody, or some friends signed
	// in. The Leo OS door only comes up to like or comment, or for a friend who is signed out, and it
	// can be closed again with «Ahora no».
	import PostView from './PostView.svelte';
	import Visitor from './Visitor.svelte';

	let { code }: { code: string } = $props();

	let door = $state(false);
	let deleted = $state(false);

	/** The app itself, where an account's own posts are. */
	const home = $derived(typeof location === 'undefined' ? './' : location.pathname);
</script>

<Visitor bind:door>
	{#if deleted}
		<div class="note">
			<h2>Eliminaste esta publicación</h2>
			<p>Quien tenga el enlace ya no podrá verla.</p>
			<a class="secondary" href={home}>Ir a tu perfil</a>
		</div>
	{:else}
		<PostView {code} onaccount={() => (door = true)} ondeleted={() => (deleted = true)} />
	{/if}
</Visitor>

<style>
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
</style>
