<script lang="ts">
	import { page } from '$app/state';
	import Composer from '$lib/components/Composer.svelte';
	import OwnPost from '$lib/components/OwnPost.svelte';
	import ProfileView from '$lib/components/ProfileView.svelte';
	import Welcome from '$lib/components/Welcome.svelte';
	import { profile } from '$lib/profile.svelte';
</script>

{#if !profile.username}
	<Welcome />
{:else}
	<!-- The grid stays underneath, scrolled where it was, while a post or the composer is open. -->
	<ProfileView />
	{#if page.state.post}
		<OwnPost code={page.state.post} />
	{:else if page.state.composing}
		<Composer />
	{/if}
{/if}
