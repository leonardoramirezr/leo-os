<script lang="ts">
	// Posts in a grid of three, as prints pasted onto a page: each one's thumbnail outlined in ink and
	// set down a little crooked, with a sticker for what it is — a carousel, a video, a song — on one
	// corner, and another inside for whether it is for some friends only. A post opens at `href`, a
	// page of its own, or through `onopen`, over the grid.
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
		<span class="badge"><Icon name="carousel" size={14} stroke={2.4} /></span>
	{:else if post.video}
		<span class="badge"><Icon name="play" size={13} /></span>
	{:else if post.music}
		<span class="badge"><Icon name="music" size={14} stroke={2.6} /></span>
	{/if}
	{#if post.audience === 'friends'}
		<span class="badge friends"><Icon name="friends" size={15} stroke={2.4} /></span>
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
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px 10px;
		margin: 0;
		padding: 4px 14px 24px;
		list-style: none;
	}

	/* Pasted by hand: each column a little crooked its own way. */
	li:nth-child(3n + 1) {
		rotate: -1.5deg;
	}

	li:nth-child(3n + 2) {
		rotate: 1deg;
		translate: 0 4px;
	}

	li:nth-child(3n) {
		rotate: -0.5deg;
	}

	.tile {
		display: block;
		position: relative;
		width: 100%;
		padding: 0;
		border: var(--line) solid var(--ink);
		border-radius: 10px;
		aspect-ratio: 1;
		background: var(--placeholder);
	}

	.tile img {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 7px;
		object-fit: cover;
	}

	.badge {
		display: grid;
		position: absolute;
		top: -8px;
		right: -8px;
		place-items: center;
		width: 28px;
		height: 28px;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		background: var(--lilac);
		color: var(--on-lilac);
	}

	.badge.friends {
		top: auto;
		right: auto;
		bottom: 6px;
		left: 6px;
		background: var(--card);
		color: var(--text);
	}
</style>
