<script lang="ts">
	// Picks the moment of a song a post plays: the song drawn as bars across the screen, and the
	// stretch that plays lit up over them. Dragging moves it, a tap puts its start where it lands,
	// and it plays on a loop while it is picked, the way it will sound on the post.
	import { onDestroy, onMount } from 'svelte';
	import { clock } from '$lib/format';
	import { CLIP_SECONDS } from '$lib/music/clip';
	import { Player } from '$lib/music/player.svelte';
	import Icon from './Icon.svelte';

	let {
		src,
		duration,
		levels,
		start = $bindable()
	}: {
		/** Where to listen to it from while picking. */
		src: string;
		duration: number;
		/** How loud each stretch is, from 0 to 1, as many as there are bars. */
		levels: number[];
		start: number;
	} = $props();

	/** The shortest stretch worth looping. */
	const SHORTEST = 5;

	const latest = $derived(Math.max(0, duration - Math.min(SHORTEST, duration)));
	const length = $derived(Math.min(CLIP_SECONDS, duration - start));

	let strip: HTMLDivElement;
	let player = $state<Player>();
	let drag: { x: number; start: number; moved: boolean } | undefined;

	onMount(() => {
		player = new Player(src, start, length);
		player.play();
	});
	onDestroy(() => player?.destroy());

	function clamp(value: number): number {
		return Math.min(latest, Math.max(0, value));
	}

	/** Moves the start, and plays from it once it is let go. */
	function set(value: number, listen: boolean) {
		start = Math.round(clamp(value) * 10) / 10;
		if (!listen || !player) return;
		player.setMoment(start, length);
		player.restart();
	}

	function onpointerdown(event: PointerEvent) {
		strip.setPointerCapture(event.pointerId);
		drag = { x: event.clientX, start, moved: false };
	}

	function onpointermove(event: PointerEvent) {
		if (!drag) return;
		const dx = event.clientX - drag.x;
		if (Math.abs(dx) > 4) drag.moved = true;
		if (drag.moved) set(drag.start + (dx / strip.clientWidth) * duration, false);
	}

	function onpointerup(event: PointerEvent) {
		if (!drag) return;
		const { moved } = drag;
		drag = undefined;
		// A tap, not a drag: the start goes where it landed.
		if (!moved) {
			const box = strip.getBoundingClientRect();
			set(((event.clientX - box.left) / box.width) * duration, true);
		} else {
			set(start, true);
		}
	}

	function onkeydown(event: KeyboardEvent) {
		const step = event.shiftKey ? 5 : 1;
		if (event.key === 'ArrowRight') set(start + step, true);
		else if (event.key === 'ArrowLeft') set(start - step, true);
		else return;
		event.preventDefault();
	}
</script>

<div class="picker">
	<div class="times">
		<span>{clock(start)}</span>
		<span class="muted">hasta {clock(start + length)}</span>
	</div>

	<div
		class="strip"
		bind:this={strip}
		{onpointerdown}
		{onpointermove}
		{onpointerup}
		onpointercancel={() => (drag = undefined)}
		{onkeydown}
		role="slider"
		tabindex="0"
		aria-label="Momento de la canción"
		aria-valuemin={0}
		aria-valuemax={Math.floor(latest)}
		aria-valuenow={Math.floor(start)}
		aria-valuetext="Desde {clock(start)}"
	>
		<div class="bars" aria-hidden="true">
			{#each levels as level, i (i)}
				{@const at = ((i + 0.5) / levels.length) * duration}
				<span class:lit={at >= start && at <= start + length} style:height="{8 + level * 92}%"></span>
			{/each}
		</div>
		<div
			class="window"
			style:left="{(start / duration) * 100}%"
			style:width="{(length / duration) * 100}%"
			aria-hidden="true"
		></div>
	</div>

	<div class="controls">
		<button
			class="nudge"
			type="button"
			onclick={() => set(start - 1, true)}
			aria-label="Un segundo antes"
		>
			<Icon name="back" size={18} /> 1 s
		</button>
		<button
			class="play"
			type="button"
			onclick={() => player?.toggle()}
			aria-label={player?.playing ? 'Pausar' : 'Escuchar'}
		>
			<Icon name={player?.playing ? 'pause' : 'play'} size={22} stroke={3} />
		</button>
		<button
			class="nudge"
			type="button"
			onclick={() => set(start + 1, true)}
			aria-label="Un segundo después"
		>
			1 s <Icon name="forward" size={18} />
		</button>
	</div>
	<p class="hint">
		Arrastra la franja, o toca donde quieras que empiece. Suenan {Math.round(length)} segundos.
	</p>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
	}

	.times {
		display: flex;
		justify-content: space-between;
		font: 700 14px/1 var(--mono);
	}

	.muted {
		color: var(--muted);
		font-weight: 400;
	}

	.strip {
		position: relative;
		height: 76px;
		border: var(--line) solid var(--ink);
		border-radius: 12px;
		background: var(--card);
		cursor: grab;
		touch-action: none;
		-webkit-user-select: none;
		user-select: none;
	}

	.strip:active {
		cursor: grabbing;
	}

	.bars {
		display: flex;
		align-items: center;
		gap: 2px;
		height: 100%;
		padding: 8px 6px;
	}

	.bars span {
		flex: 1;
		min-width: 1px;
		border-radius: 2px;
		background: var(--muted);
		opacity: 0.45;
	}

	.bars span.lit {
		background: var(--accent);
		opacity: 1;
	}

	/* What plays, as a lime highlighter over the strip. */
	.window {
		position: absolute;
		top: -2px;
		bottom: -2px;
		border: 3px solid var(--ink);
		border-radius: 12px;
		background: color-mix(in srgb, var(--lime) 35%, transparent);
		pointer-events: none;
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 20px;
	}

	.play {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		padding: 0;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		background: var(--lime);
		color: var(--on-lime);
		box-shadow: 3px 3px 0 var(--ink);
	}

	.nudge {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 8px 10px 7px;
		border: 2px solid var(--ink);
		border-radius: 10px;
		background: var(--card);
		font: 700 12px/1 var(--mono);
	}

	.hint {
		margin: 0;
		text-align: center;
	}
</style>
