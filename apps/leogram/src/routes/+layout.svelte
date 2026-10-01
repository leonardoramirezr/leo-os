<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account, pull } from '@leo-os/shared';
	import { page } from '$app/state';
	import PostPage from '$lib/components/PostPage.svelte';
	import { readMine } from '$lib/mine';
	import { posts } from '$lib/posts.svelte';
	import { profile } from '$lib/profile.svelte';

	let { children } = $props();

	// A post's link opens for anybody, signed in or not: it is the one screen outside the door.
	// Everything else is the account's own posts.
	const code = $derived(page.url.searchParams.get('p'));

	// What the device kept shows at once; the profile and the grid come from one read after it.
	async function load(userId: string) {
		profile.restore(userId);
		posts.restore(userId);
		const mine = await pull(readMine);
		if (mine) {
			profile.adopt(mine);
			posts.adopt(mine.posts);
		}
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

{#if code !== null}
	<PostPage {code} />
{:else}
	<Account {load}>
		{@render children()}
	</Account>
{/if}
