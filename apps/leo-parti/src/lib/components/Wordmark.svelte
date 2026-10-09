<script lang="ts">
	// «LEO PARTĪ» as the fanzine prints its name: condensed capitals in the main ink, with the second
	// one a hair off it. Set in the app's own Bricolage Grotesque, which travels with it.
	let { height = 29 }: { height?: number } = $props();

	// The font's subset has no Ī of its own, but it has the combining macron and where it sits on an
	// I: written apart, the macron comes from the same font instead of a fallback one.
	const name = 'Leo Partī';
</script>

<span class="wordmark display misprint" style:font-size="{height}px" role="img" aria-label="Leo Partī">
	{name}
</span>

<style>
	.wordmark {
		display: block;
		flex: none;
		line-height: 1;
		white-space: nowrap;
	}
</style>
