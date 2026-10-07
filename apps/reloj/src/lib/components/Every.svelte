<script lang="ts">
	// How often one of the three speaks: never, or every 1, 5, 10, 15 or 30 minutes, or every hour. A
	// row of keys printed like the display's, the one picked solid.
	import { spokenLeft, spokenRun } from '$lib/format';
	import { EVERY, every, minutesOf, type Mode } from '$lib/watch.svelte';

	let { mode }: { mode: Mode } = $props();

	const picked = $derived(minutesOf(mode));

	function short(minutes: number): string {
		return minutes === 0 ? 'No' : minutes === 60 ? '1 h' : `${minutes}`;
	}

	function long(minutes: number): string {
		if (minutes === 0) return 'Nunca';
		return minutes === 1 ? 'Cada minuto' : minutes === 60 ? 'Cada hora' : `Cada ${minutes} minutos`;
	}

	/** What it will say, with the marks it says it on. */
	const hint = $derived.by(() => {
		if (!picked) return 'Callado.';
		if (mode === 'stopwatch') return `«${spokenRun(picked)}», «${spokenRun(picked * 2)}»…`;
		if (mode === 'timer') return `«${spokenLeft(picked * 2)}», «${spokenLeft(picked)}»…`;
		if (picked === 1) return 'La hora, cada minuto.';
		if (picked === 60) return 'La hora, en punto.';
		const marks = [0, picked, picked * 2].map((minute) => `:${String(minute).padStart(2, '0')}`);
		return picked === 30 ? 'La hora, a las :00 y a las :30.' : `La hora, a las ${marks.join(', ')}…`;
	});
</script>

<section class="panel every">
	<h2 class="label">En voz alta, cada</h2>
	<div class="options" role="radiogroup" aria-label="En voz alta, cada">
		{#each EVERY as minutes (minutes)}
			<button
				class="option"
				class:on={picked === minutes}
				role="radio"
				aria-checked={picked === minutes}
				aria-label={long(minutes)}
				title={long(minutes)}
				onclick={() => (every[mode].value = minutes)}
			>
				{short(minutes)}
			</button>
		{/each}
	</div>
	<p class="hint">{hint}</p>
</section>

<style>
	.every {
		gap: 10px;
	}

	.options {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 6px;
	}

	.option {
		min-width: 0;
		min-height: 40px;
		padding: 0;
		border: 2px solid var(--ink);
		border-radius: 9px;
		background: transparent;
		color: var(--ink);
		font-size: 14px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.option.on {
		background: var(--ink);
		color: var(--paper);
	}

	.hint {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.35;
		opacity: 0.7;
	}
</style>
