<script lang="ts">
	// «LEOGRAM» as the fanzine prints its name: condensed capitals in the main ink, with the second
	// one a hair off it. Set in the app's own Bricolage Grotesque, which travels with it.
	let { height = 29 }: { height?: number } = $props();
</script>

<span class="wordmark display misprint" style:font-size="{height}px" role="img" aria-label="Leogram">
	Leogram
</span>

<style>
	.wordmark {
		display: block;
		flex: none;
		line-height: 1;
		white-space: nowrap;
	}
</style>
