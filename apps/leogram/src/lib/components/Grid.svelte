<script lang="ts">
	// Posts in a grid of three, as Instagram has a profile's: each one's thumbnail, with what it is —
	// a carousel, a video, a song — in one corner, and in the other whether it is for some friends
	// only. A post opens at `href`, a page of its own, or through `onopen`, over the grid.
	import type { Tile } from '$lib/bio';
	import Icon from './Icon.svelte';

	let {
		posts,
		href,
		onopen
	}: { posts: Tile[]; href?: (id: string) => string; onopen?: (id: string) => void } = $props();

	function label(post: Tile): string {
		return post.audience === 'friends'
			? 'Abrir la publicación, solo para algunos amigos'
			: 'Abrir la publicación';
	}
</script>

{#snippet tile(post: Tile)}
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
	{#if post.audience === 'friends'}
		<span class="badge friends"><Icon name="friends" size={18} stroke={2.4} /></span>
	{/if}
{/snippet}

<ul class="grid">
	{#each posts as post (post.id)}
		<li>
			{#if href}
				<a class="tile" href={href(post.id)} aria-label={label(post)}>{@render tile(post)}</a>
			{:else}
				<button class="tile" type="button" onclick={() => onopen?.(post.id)} aria-label={label(post)}>
					{@render tile(post)}
				</button>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tile {
		display: block;
		position: relative;
		width: 100%;
		padding: 0;
		border: 0;
		aspect-ratio: 1;
		background: var(--placeholder);
	}

	.tile img {
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

	.badge.friends {
		right: auto;
		left: 8px;
	}
</style>
