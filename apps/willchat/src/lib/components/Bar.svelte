<script lang="ts">
	// The bar along the top of every screen. Whatever else it holds, the way back to the home screen
	// is always last, out in the top right corner (CLAUDE.md, «An app's contract»).
	import type { Snippet } from 'svelte';
	import { HomeButton } from '@leo-os/shared';
	import { t } from '$lib/i18n';

	let { start, end, children }: { start?: Snippet; end?: Snippet; children: Snippet } = $props();
</script>

<header>
	<div class="start">{@render start?.()}</div>
	<div class="center">{@render children()}</div>
	<div class="end">
		{@render end?.()}
		<HomeButton label={t.apps} />
	</div>
</header>

<style>
	/* Both sides as wide as the wider of them, so the title stays in the middle. */
	header {
		display: grid;
		flex: none;
		grid-template-columns: minmax(max-content, 1fr) minmax(0, auto) minmax(max-content, 1fr);
		align-items: center;
		gap: 4px;
		padding: calc(env(safe-area-inset-top) + 6px) max(10px, env(safe-area-inset-right)) 6px
			max(10px, env(safe-area-inset-left));
	}

	.start,
	.end {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.end {
		justify-content: flex-end;
	}

	.center {
		display: flex;
		justify-content: center;
		min-width: 0;
	}
</style>
