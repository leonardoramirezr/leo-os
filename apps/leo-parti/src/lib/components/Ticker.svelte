<script lang="ts">
	// A strip of tape across the page, between a profile and its posts: what follows, over and over.
	// Only for the eye: the count it repeats is said once already, above it.
	let { words }: { words: string } = $props();
</script>

<!-- Clipped at the page's sides, which the tape runs past: it must not make the page scroll across. -->
<div class="tape" aria-hidden="true">
	<div class="ticker display">
		{#each Array.from({ length: 5 }, (_, i) => i) as i (i)}<span>{words}</span><b>✶</b>{/each}
	</div>
</div>

<style>
	.tape {
		padding: 10px 0 22px;
		overflow-x: clip;
	}

	.ticker {
		margin: 0 -12px;
		overflow: hidden;
		border-block: 3px solid var(--ink);
		background: var(--accent);
		color: var(--on-accent);
		font-size: 19px;
		letter-spacing: 0.02em;
		line-height: 34px;
		white-space: nowrap;
		transform: rotate(-2deg);
	}

	b {
		margin: 0 10px;
		color: var(--star);
	}
</style>
