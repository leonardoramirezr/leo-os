<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { page } from '$app/state';
	import PostPage from '$lib/components/PostPage.svelte';
	import { posts } from '$lib/posts.svelte';
	import { profile } from '$lib/profile.svelte';

	let { children } = $props();

	// A post's link opens for anybody, signed in or not: it is the one screen outside the door.
	// Everything else is the account's own posts.
	const code = $derived(page.url.searchParams.get('p'));

	async function load(userId: string) {
		await Promise.all([profile.load(userId), posts.load(userId)]);
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
