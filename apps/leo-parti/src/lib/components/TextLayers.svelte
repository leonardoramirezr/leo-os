<script lang="ts">
	// A photo's texts over it, drawn on a canvas by the same code that draws them into the photo when
	// the post is published: what shows here is what goes up.
	import { onMount } from 'svelte';
	import { drawTexts, relayout, type TextLayer } from '$lib/text';

	let {
		layers,
		skip,
		faded
	}: {
		layers: readonly TextLayer[];
		/** The one being typed, which its field shows instead. */
		skip?: string;
		/** The one held over the bin. */
		faded?: string;
	} = $props();

	let canvas: HTMLCanvasElement;
	let width = $state(0);
	let height = $state(0);
	/** Counts the fonts arriving, to draw again with them. */
	let fonts = $state(0);

	onMount(() => {
		const observer = new ResizeObserver(([entry]) => {
			width = entry.contentRect.width;
			height = entry.contentRect.height;
		});
		observer.observe(canvas);
		// The device's own fonts are there from the start, but a browser may still be reading one.
		document.fonts.ready.then(() => {
			relayout();
			fonts++;
		});
		return () => observer.disconnect();
	});

	$effect(() => {
		void fonts;
		// Pixel for pixel of the screen, so that the letters are as sharp as the rest.
		const ratio = window.devicePixelRatio || 1;
		const [w, h] = [Math.round(width * ratio), Math.round(height * ratio)];
		if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
		const context = canvas.getContext('2d');
		if (!context) return;
		context.clearRect(0, 0, w, h);
		if (w && h) drawTexts(context, layers, w, h, { skip, faded });
	});
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
	canvas {
		display: block;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
