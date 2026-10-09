<script lang="ts">
	// The way back to the home screen. Every screen of every app has it in the same place, the right
	// end of its top bar (CLAUDE.md, «An app's contract»); a sheet over it may leave it out of reach.
	//
	// An app lives at <BASE_PATH>/<folder>/ with no route but its root, so the home screen is always
	// one level up from wherever it is: in a shared link with ?p= as much as after a shallow route.
	let { label = 'Apps' }: { label?: string } = $props();
</script>

<!-- A full load: the home screen is another app. -->
<a class="home-button" href="../" aria-label={label} title={label} data-sveltekit-reload>
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
	/* The colour is the bar's: it sits on light screens and dark ones, a treadmill's display and a
	   photo's black. */
	.home-button {
		display: grid;
		flex: none;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		color: inherit;
		-webkit-tap-highlight-color: transparent;
	}

	svg {
		display: block;
	}

	/* Made of its own colour: an app's --hover is for its pages, not for a display or a photo's black. */
	@media (hover: hover) {
		.home-button:hover {
			background: color-mix(in srgb, currentColor 10%, transparent);
		}
	}
</style>
