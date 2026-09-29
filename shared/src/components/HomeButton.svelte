<script lang="ts">
	// The way back to the home screen. Every screen of every app has it, first in the bar along its
	// top edge: the same button in the same corner wherever it is, since a web app added to the home
	// screen has no browser controls to leave by.
	//
	// The home screen is the folder above the app's, which only the app can name: `{resolve('/')}../`.
	let { href }: { href: string } = $props();
</script>

<a class="home" {href} aria-label="Apps" title="Apps" data-sveltekit-reload>
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<rect x="3.5" y="3.5" width="7" height="7" rx="2" />
		<rect x="13.5" y="3.5" width="7" height="7" rx="2" />
		<rect x="3.5" y="13.5" width="7" height="7" rx="2" />
		<rect x="13.5" y="13.5" width="7" height="7" rx="2" />
	</svg>
</a>

<style>
	/* The size of the apps' own icon buttons, so that it lines up with whatever shares the bar. */
	.home {
		display: grid;
		flex: none;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		color: var(--text);
	}

	@media (hover: hover) {
		.home:hover {
			background: var(--hover);
		}
	}
</style>
