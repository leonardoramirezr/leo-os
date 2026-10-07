<script lang="ts">
	// How an exercise is done: the user's own GIF or video when the routine gives one, else the
	// catalog's animation, else a dumbbell where none is to be had.
	import { exerciseOf, gifUrl } from '$lib/catalog';
	import Icon from './Icon.svelte';

	let {
		exercise = '',
		media = '',
		thumb = false
	}: {
		/** The catalog's id. */
		exercise?: string;
		/** A GIF's or a video's address of the user's own. */
		media?: string;
		/** Small, in a list. */
		thumb?: boolean;
	} = $props();

	const gif = $derived(exerciseOf(exercise)?.gif);
	const source = $derived(media.trim() || (gif ? gifUrl(gif) : ''));
	const video = $derived(/\.(mp4|webm|mov|m4v)([?#]|$)/i.test(source));

	/** The address that would not load: a dumbbell stands in until the source changes. */
	let failed = $state('');
</script>

<div class="media" class:thumb>
	{#if source && failed !== source}
		{#if video}
			<!-- Muted and inline, the only way a page may play a video by itself on iOS. -->
			<video src={source} autoplay muted loop playsinline onerror={() => (failed = source)}></video>
		{:else}
			<img
				src={source}
				alt=""
				loading={thumb ? 'lazy' : 'eager'}
				decoding="async"
				onerror={() => (failed = source)}
			/>
		{/if}
	{:else}
		<span class="none"><Icon name="dumbbell" size={thumb ? 22 : 64} stroke={thumb ? 2 : 1.5} /></span>
	{/if}
</div>

<style>
	.media {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--media);
	}

	.thumb {
		width: 48px;
		height: 48px;
		flex: none;
		border-radius: 10px;
	}

	/* Pinned to the box, whatever its shape: a square GIF in a wide frame shows whole, not cropped. */
	img,
	video {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.none {
		color: #c7c7cc;
	}
</style>
