<script lang="ts" module>
	// Twenty-four points around a circle, every other one pulled in: a starburst on a 100-unit grid.
	const STAR = Array.from({ length: 48 }, (_, i) => {
		const angle = (i / 48) * Math.PI * 2;
		const radius = i % 2 ? 43 : 50;
		return `${(50 + Math.cos(angle) * radius).toFixed(2)},${(50 + Math.sin(angle) * radius).toFixed(2)}`;
	}).join(' ');
</script>

<script lang="ts">
	// A sticker cut as a starburst and slapped on at an angle, over its own hard shadow: a face, or
	// the glyph of an empty page. Drawn, not clipped, so its edge stays sharp on a 3x screen.
	import type { Snippet } from 'svelte';

	let {
		size = 88,
		tilt = 0,
		fill = 'var(--lilac)',
		children
	}: {
		size?: number;
		/** Degrees it is turned by. */
		tilt?: number;
		fill?: string;
		/** What is stuck in the middle. */
		children?: Snippet;
	} = $props();
</script>

<span class="burst" style:--size="{size}px" style:rotate="{tilt}deg">
	<svg viewBox="0 0 104 104" aria-hidden="true">
		<polygon class="shadow" points={STAR} transform="translate(3.5 3.5)" />
		<polygon class="face" points={STAR} style:fill={fill} />
	</svg>
	{#if children}
		<span class="inside">{@render children()}</span>
	{/if}
</span>

<style>
	.burst {
		display: grid;
		position: relative;
		flex: none;
		place-items: center;
		width: var(--size);
		height: var(--size);
	}

	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}

	.shadow {
		fill: var(--ink);
	}

	.face {
		stroke: var(--ink);
		stroke-width: 1.5;
		stroke-linejoin: round;
	}

	/* Centred on the star itself, not on the star and its shadow. */
	.inside {
		display: grid;
		position: relative;
		place-items: center;
		margin: 0 3.4% 3.4% 0;
		color: var(--on-lilac);
	}
</style>
