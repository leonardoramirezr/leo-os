<script lang="ts">
	import icon from '../../../icon.svg';
	import { pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { clock, length, plural } from '$lib/format';
	import { lengthOf, programs, type Program } from '$lib/programs.svelte';
	import { runner } from '$lib/runner.svelte';
	import { unlock } from '$lib/voice';
	import Icon from './Icon.svelte';
	import Profile from './Profile.svelte';
	import ProgramSheet from './ProgramSheet.svelte';

	let sheetOpen = $state(false);
	/** The program the sheet changes; none while it creates one. */
	let editing = $state<Program>();

	function create() {
		editing = undefined;
		sheetOpen = true;
	}

	function edit(program: Program) {
		editing = program;
		sheetOpen = true;
	}

	/** A tap on a program starts it, and the screen it runs on takes over. */
	function start(program: Program) {
		const current = runner.run;
		if (current && !runner.finished) {
			// Tapped the one running: back to it, from where it is.
			if (current.program.id === program.id) return show();
			const running = current.program.name;
			if (!confirm(`«${running}» sigue en curso. ¿Terminarlo y empezar «${program.name}»?`)) return;
		}

		runner.start(program);
		pushState('', { run: true });
	}

	/** Back to the program running, which went on meanwhile. */
	function show() {
		unlock();
		pushState('', { run: true });
	}
</script>

<div class="screen">
	<header class="bar">
		<a class="icon-button" href="{resolve('/')}../" aria-label="Apps" title="Apps" data-sveltekit-reload>
			<Icon name="apps" />
		</a>
	</header>

	<h1>Caminadora</h1>

	{#if runner.run}
		<button class="current" onclick={show}>
			<span class="current-icon">
				<Icon name={runner.finished ? 'check' : runner.paused ? 'pause' : 'play'} size={18} />
			</span>
			<span class="text">
				<span class="name">{runner.run.program.name}</span>
				<span class="meta">
					{runner.finished ? 'Terminado' : runner.paused ? 'En pausa' : 'En curso'} ·
					{clock(runner.elapsed)} de {clock(runner.total)}
				</span>
			</span>
			<span class="chevron"><Icon name="forward" size={18} /></span>
		</button>
	{/if}

	{#if programs.list.length}
		<p class="caption">Toca un programa para empezarlo.</p>

		<ul class="programs">
			{#each programs.sorted as program (program.id)}
				<li class="program">
					<button class="start" onclick={() => start(program)}>
						<span class="text">
							<span class="name">{program.name}</span>
							<span class="meta">
								{length(lengthOf(program.segments))} ·
								{plural(program.segments.length, 'segmento', 'segmentos')}
							</span>
						</span>
						<span class="preview"><Profile segments={program.segments} gap={1.5} /></span>
					</button>
					<button
						class="icon-button edit"
						onclick={() => edit(program)}
						aria-label="Editar «{program.name}»"
						title="Editar"
						aria-haspopup="dialog"
					>
						<Icon name="edit" size={19} />
					</button>
				</li>
			{/each}
			<li>
				<button class="add" onclick={create} aria-haspopup="dialog">
					<Icon name="plus" />
					Nuevo programa
				</button>
			</li>
		</ul>
	{:else}
		<div class="empty">
			<img class="logo" src={icon} alt="" width="84" height="84" />
			<p class="empty-title">Crea tu primer programa</p>
			<p class="empty-text">
				Un programa es una serie de segmentos, cada uno con su tiempo y su velocidad. Mientras caminas
				o corres, la app te dice en voz alta cuándo cambiar la velocidad de la caminadora.
			</p>
			<button class="primary" onclick={create} aria-haspopup="dialog">Crear programa</button>
		</div>
	{/if}
</div>

<ProgramSheet bind:open={sheetOpen} program={editing} />

<style>
	.screen {
		max-width: 560px;
		margin: 0 auto;
		padding: 0 16px calc(32px + env(safe-area-inset-bottom));
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0 -8px;
		padding-top: calc(env(safe-area-inset-top) + 6px);
	}

	h1 {
		margin: 2px 4px 0;
		font-size: 34px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.caption {
		margin: 2px 4px 20px;
		color: var(--muted);
		font-size: 15px;
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
	}

	.name {
		overflow: hidden;
		font-size: 17px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		color: var(--muted);
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}

	.chevron {
		color: var(--faint);
	}

	/* The program running, while its screen is not the one showing. */
	.current {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		margin: 14px 0 6px;
		padding: 12px 12px 12px 14px;
		border: 0;
		border-radius: 18px;
		background: var(--accent);
		color: var(--on-accent);
		text-align: left;
	}

	.current .meta,
	.current .chevron {
		color: inherit;
		opacity: 0.7;
	}

	.current-icon {
		display: grid;
		flex: none;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: var(--on-accent);
		color: var(--accent);
	}

	.programs {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.program {
		display: flex;
		align-items: center;
		min-height: 74px;
		border-radius: 18px;
		background: var(--group);
		box-shadow: var(--shadow);
		transition: transform 0.12s;
	}

	.program:has(.start:active) {
		transform: scale(0.98);
	}

	.start {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 14px;
		min-width: 0;
		align-self: stretch;
		padding: 14px 6px 14px 18px;
		border: 0;
		border-radius: 18px 0 0 18px;
		background: none;
		text-align: left;
	}

	.preview {
		flex: none;
		width: 84px;
		height: 34px;
		color: var(--text);
	}

	.edit {
		margin-right: 8px;
		color: var(--muted);
	}

	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		min-height: 56px;
		border: 1.5px dashed var(--border);
		border-radius: 18px;
		background: transparent;
		color: var(--text);
		font-size: 16px;
		font-weight: 600;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 12px;
		text-align: center;
	}

	.logo {
		border-radius: 22.5%;
		box-shadow: var(--shadow);
	}

	.empty-title {
		margin: 20px 0 8px;
		font-size: 20px;
		font-weight: 700;
	}

	.empty-text {
		max-width: 330px;
		margin: 0 0 24px;
		color: var(--muted);
		line-height: 1.5;
	}

	.empty .primary {
		max-width: 280px;
	}
</style>
