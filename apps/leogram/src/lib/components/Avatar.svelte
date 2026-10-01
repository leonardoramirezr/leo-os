<script lang="ts">
	// A profile photo, round. Whoever has none shows the first letter of their username on grey, and
	// so does a photo that does not load: an address kept on the device from days ago, say.
	let {
		src = '',
		username = '',
		size = 32,
		ring = false
	}: {
		src?: string;
		username?: string;
		size?: number;
		/** Instagram's gradient around it, as a story ring. */
		ring?: boolean;
	} = $props();

	const letter = $derived((username.replace(/[^a-z0-9]/gi, '')[0] ?? '').toUpperCase());
	/** The address that did not load. */
	let failed = $state('');
</script>

<span class="avatar" class:ring style:--size="{size}px">
	{#if src && src !== failed}
		<img {src} alt="" onerror={() => (failed = src)} />
	{:else}
		<span class="letter" aria-hidden="true">{letter}</span>
	{/if}
</span>

<style>
	.avatar {
		display: grid;
		flex: none;
		place-items: center;
		width: var(--size);
		height: var(--size);
		overflow: hidden;
		border-radius: 50%;
		background: var(--field);
		color: var(--muted);
	}

	/* The gradient shows as a band around the photo: the photo sits inside it, with a gap in the
	   page's colour. */
	.ring {
		padding: calc(var(--size) * 0.05);
		background: var(--gradient);
	}

	.ring > img,
	.ring > .letter {
		border: calc(var(--size) * 0.04) solid var(--bg);
		border-radius: 50%;
		background: var(--field);
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
		font-size: calc(var(--size) * 0.42);
		font-weight: 600;
	}
</style>
