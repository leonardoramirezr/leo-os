<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account, pull } from '@leo-os/shared';
	import { page } from '$app/state';
	import BioPage from '$lib/components/BioPage.svelte';
	import PostPage from '$lib/components/PostPage.svelte';
	import { readMine } from '$lib/mine';
	import { favorites } from '$lib/people.svelte';
	import { posts } from '$lib/posts.svelte';
	import { profile } from '$lib/profile.svelte';

	let { children } = $props();

	// A post's link and a bio open for anybody, signed in or not: they are the two screens outside
	// the door. Everything else is the account's own posts.
	const code = $derived(page.url.searchParams.get('p'));
	const bio = $derived(page.url.searchParams.get('u'));

	// What the device kept shows at once; the profile, the grid and the favourites come from one read
	// after it.
	async function load(userId: string) {
		profile.restore(userId);
		posts.restore(userId);
		favorites.restore(userId);
		const mine = await pull(readMine);
		if (mine) {
			profile.adopt(mine);
			posts.adopt(mine.posts);
			favorites.adopt(mine.favorites);
		}
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

{#if code !== null}
	<PostPage {code} />
{:else if bio !== null}
	<BioPage username={bio} />
{:else}
	<Account {load}>
		{@render children()}
	</Account>
{/if}
