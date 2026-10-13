<script lang="ts">
	// A profile photo, round and outlined in ink. Whoever has none shows the first letter of their
	// username on a lilac sticker, and so does a photo that does not load: an address kept on the
	// device from days ago, say.
	import Burst from './Burst.svelte';

	let {
		src = '',
		username = '',
		size = 32,
		ring = false
	}: {
		src?: string;
		username?: string;
		size?: number;
		/** Stuck on a starburst, as a profile's own face is: `size` is then the star's. */
		ring?: boolean;
	} = $props();

	const letter = $derived((username.replace(/[^a-z0-9]/gi, '')[0] ?? '').toUpperCase());
	/** The address that did not load. */
	let failed = $state('');
	/** The face itself: inside the star, or all of it. */
	const face = $derived(ring ? Math.round(size * 0.74) : size);
</script>

{#snippet photo()}
	<span class="avatar" class:thick={face >= 56} style:--size="{face}px">
		{#if src && src !== failed}
			<img {src} alt="" onerror={() => (failed = src)} />
		{:else}
			<span class="letter" aria-hidden="true">{letter}</span>
		{/if}
	</span>
{/snippet}

{#if ring}
	<Burst {size} tilt={9}>{@render photo()}</Burst>
{:else}
	{@render photo()}
{/if}

<style>
	.avatar {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--size);
		height: var(--size);
		overflow: hidden;
		border: 1.5px solid var(--ink);
		border-radius: 50%;
		background: var(--lilac);
		color: var(--on-lilac);
	}

	.thick {
		border-width: var(--line);
	}

	img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.letter {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		font-size: calc(var(--size) * 0.46);
		font-weight: 800;
		font-stretch: 75%;
		line-height: 1;
	}
</style>
