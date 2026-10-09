<script lang="ts">
	// The end of a workout: congratulations when every round was done, a plain «terminado» when it was
	// cut short, and in both cases what it came to — exercise by exercise, against the time before.
	import { HomeButton, type RutinaDay } from '@leo-os/shared';
	import { blockLabel } from '$lib/effort';
	import { formatDuration, formatNumber } from '$lib/format';
	import { entryName, type Routine, type Session } from '$lib/routine';
	import { sessions } from '$lib/sessions.svelte';
	import { summarize, type VolumeUnit } from '$lib/stats';
	import Icon from './Icon.svelte';

	let {
		session,
		day,
		routine,
		onclose
	}: { session: Session; day: RutinaDay; routine: Routine; onclose: () => void } = $props();

	const summary = $derived(summarize(session, day, sessions.list));

	const UNITS: Record<VolumeUnit, string> = { kg: 'kg', kgs: 'kg·s', reps: 'reps', s: 's' };

	function amount(value: number, unit: VolumeUnit): string {
		return `${formatNumber(value)} ${UNITS[unit]}`;
	}

	/** Against the time before: «▲ 4 %», «▼ 3 %», «igual». */
	function change(volume: number, before: number): { text: string; up: boolean } {
		if (!before) return { text: volume ? 'más que la vez anterior' : 'igual que la vez anterior', up: volume > 0 };
		const percent = Math.round(((volume - before) / before) * 100);
		if (!percent) return { text: 'igual que la vez anterior', up: false };
		return { text: `${percent > 0 ? '▲' : '▼'} ${Math.abs(percent)} % vs. la vez anterior`, up: percent > 0 };
	}
</script>

<div class="summary">
	<header class="top">
		<HomeButton />
	</header>

	<section class="hero">
		<div class="headline">
			<span class="badge" class:finished={session.finished}>
				<Icon name={session.finished ? 'check' : 'flag'} size={36} stroke={2.5} />
			</span>
			<div>
				{#if session.finished}
					<h1>¡Felicidades!</h1>
					<p class="lead">Terminaste {day.name} de {routine.name}.</p>
				{:else}
					<h1>Entrenamiento terminado</h1>
					<p class="lead">{day.name} de {routine.name}. Lo que hiciste quedó guardado.</p>
				{/if}
			</div>
		</div>

		<dl class="tiles">
			<div class="tile">
				<dt>Duración</dt>
				<dd>{formatDuration(summary.duration)}</dd>
			</div>
			<div class="tile">
				<dt>Series</dt>
				<dd>{summary.done}<small>{` de ${summary.planned}`}</small></dd>
			</div>
			<div class="tile">
				<dt>Volumen</dt>
				<dd>{summary.volume ? `${formatNumber(summary.volume)} kg` : '—'}</dd>
			</div>
			<div class="tile">
				<dt>Repeticiones</dt>
				<dd>{formatNumber(summary.reps)}</dd>
			</div>
		</dl>

		<button class="primary close" type="button" onclick={onclose}>Listo</button>
	</section>

	<section class="detail">
		<h2 class="section-title">Por ejercicio</h2>
		{#if summary.entries.length}
			<ul class="group">
				{#each summary.entries as item (item.entry.id)}
					{@const delta = item.before === undefined ? undefined : change(item.volume, item.before)}
					<li>
						<p class="name">{entryName(item.entry)}</p>
						<p class="sets">{item.sets.map((set) => blockLabel(set, item.entry.timed)).join(' · ')}</p>
						<p class="volume">
							{amount(item.volume, item.unit)}
							{#if delta}
								<span class:up={delta.up}>· {delta.text}</span>
							{:else}
								<span>· primera vez</span>
							{/if}
						</p>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">No llegaste a terminar ninguna serie.</p>
		{/if}
	</section>
</div>

<style>
	.summary {
		display: grid;
		gap: 8px 32px;
		max-width: 960px;
		margin: 0 auto;
		padding: calc(env(safe-area-inset-top) + 20px) calc(env(safe-area-inset-right) + 20px)
			calc(env(safe-area-inset-bottom) + 24px) calc(env(safe-area-inset-left) + 20px);
	}

	/* Pulled up and out to the corner where every other screen has the way home, so it stays put. */
	.top {
		display: flex;
		grid-column: 1 / -1;
		justify-content: flex-end;
		margin: -14px -12px -8px 0;
	}

	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.headline {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	/* Landscape, as the workout is: the headline on the left — badge and title side by side, to fit
	   a phone's height —, the exercises beside it. */
	@media (orientation: landscape) and (min-width: 600px) {
		.summary {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
			align-items: start;
			padding-top: calc(env(safe-area-inset-top) + 12px);
		}

		.top {
			margin-top: -6px;
		}

		.hero {
			position: sticky;
			top: 12px;
			align-items: stretch;
			text-align: left;
		}

		.headline {
			flex-direction: row;
			gap: 14px;
		}

		.badge {
			width: 60px;
			height: 60px;
			flex: none;
		}

		h1 {
			margin-top: 0;
		}

		.tiles {
			margin-top: 14px;
		}

		.tile {
			padding: 8px 12px;
		}

		dd {
			font-size: 19px;
		}

		.close {
			margin-top: 12px;
		}
	}

	.badge {
		display: grid;
		place-items: center;
		width: 76px;
		height: 76px;
		border-radius: 50%;
		background: var(--hover);
		color: var(--muted);
	}

	.badge.finished {
		background: var(--accent);
		color: #fff;
		animation: pop 0.5s cubic-bezier(0.2, 1.6, 0.4, 1);
	}

	@keyframes pop {
		from {
			transform: scale(0.4);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.badge.finished {
			animation: none;
		}
	}

	h1 {
		margin: 14px 0 4px;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.lead {
		margin: 0;
		color: var(--muted);
		line-height: 1.45;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		width: 100%;
		margin: 20px 0 0;
	}

	.tile {
		padding: 12px 14px;
		border-radius: 14px;
		background: var(--group);
		text-align: left;
	}

	dt {
		color: var(--muted);
		font-size: 13px;
	}

	dd {
		margin: 2px 0 0;
		font-size: 22px;
		font-weight: 600;
	}

	dd small {
		color: var(--muted);
		font-size: 15px;
		font-weight: 400;
	}

	.close {
		margin-top: 18px;
	}

	.detail .section-title:first-child {
		margin-top: 16px;
	}

	.detail li {
		padding: 12px 16px;
	}

	.detail li + li {
		border-top: 1px solid var(--border);
	}

	.detail p {
		margin: 0;
	}

	.name {
		font-size: 16px;
		font-weight: 600;
	}

	.sets {
		margin-top: 3px !important;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
	}

	.volume {
		margin-top: 3px !important;
		color: var(--muted);
		font-size: 13px;
	}

	.volume .up {
		color: var(--tint);
	}

	.empty {
		margin: 0 4px;
		color: var(--muted);
	}
</style>
