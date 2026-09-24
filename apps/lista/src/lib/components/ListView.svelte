<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { list } from '$lib/list.svelte';
	import { voice } from '$lib/voice.svelte';
	import Icon from './Icon.svelte';
	import SettingsSheet from './SettingsSheet.svelte';
	import VoiceBar from './VoiceBar.svelte';

	let settingsOpen = $state(false);

	const total = $derived(list.items.length);
	const done = $derived(list.items.filter((item) => item.done).length);

	const summary = $derived.by(() => {
		if (done === total) return 'Todo listo';

		const pending = total - done;
		const left = `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}`;
		return done ? `${left} · ${done} ${done === 1 ? 'hecho' : 'hechos'}` : left;
	});

	// What a voice command just added or rewrote lights up for a moment and is scrolled to: it may be
	// below the fold, or under the bar. Played by hand rather than with a class, so that an item
	// changed twice in a row lights up both times.
	$effect(() => {
		const ids = list.recent;
		if (!ids.length) return;

		tick().then(() => {
			const flash = getComputedStyle(document.documentElement).getPropertyValue('--flash');
			const rows = ids.flatMap((id) => document.querySelector(`[data-id="${id}"]`) ?? []);
			for (const row of rows) {
				row.animate([{ backgroundColor: flash }, { backgroundColor: 'transparent' }], {
					duration: 2000,
					easing: 'ease-out'
				});
			}
			rows.at(-1)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		});
	});

	$effect(() => {
		const onhide = () => {
			if (document.visibilityState === 'hidden') voice.interrupt();
		};
		document.addEventListener('visibilitychange', onhide);
		return () => document.removeEventListener('visibilitychange', onhide);
	});
</script>

<div class="screen">
	<header>
		<a class="icon-button" href="{resolve('/')}../" aria-label="Apps" title="Apps" data-sveltekit-reload>
			<Icon name="apps" />
		</a>
		<button
			class="icon-button"
			onclick={() => (settingsOpen = true)}
			aria-label="Ajustes"
			title="Ajustes"
			aria-haspopup="dialog"
		>
			<Icon name="settings" />
		</button>
	</header>

	<h1>Lista</h1>

	{#if total}
		<p class="caption">{summary}</p>

		<ul class="group">
			{#each list.items as item (item.id)}
				<li class="item" data-id={item.id}>
					<label class:done={item.done}>
						<input type="checkbox" checked={item.done} onchange={() => list.toggle(item.id)} />
						<span class="box" aria-hidden="true"><Icon name="check" size={15} stroke={3} /></span>
						<span class="text">{item.text}</span>
					</label>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="empty">
			<p class="empty-title">Tu lista está vacía</p>
			<p class="empty-text">
				Toca el micrófono y di lo que quieras anotar. Después la cambias igual, hablando. Por ejemplo:
			</p>
			<ul class="examples">
				<li>«Leche, huevos y pan»</li>
				<li>«Agrega tortillas y queso»</li>
				<li>«Cambia la leche por leche deslactosada»</li>
				<li>«Quita el pan»</li>
				<li>«Ya compré los huevos»</li>
				<li>«Empieza una lista nueva»</li>
			</ul>
		</div>
	{/if}
</div>

<VoiceBar />

<SettingsSheet bind:open={settingsOpen} />

<style>
	.screen {
		max-width: 560px;
		margin: 0 auto;
		/* Room so that the bar with the microphone does not cover the last item. */
		padding: 0 16px calc(210px + env(safe-area-inset-bottom));
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0 -8px;
		padding-top: calc(env(safe-area-inset-top) + 6px);
	}

	.icon-button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 12px;
		background: transparent;
		color: var(--text);
	}

	@media (hover: hover) {
		.icon-button:hover {
			background: var(--hover);
		}
	}

	h1 {
		margin: 2px 4px 0;
		font-size: 34px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.caption {
		margin: 2px 4px 16px;
		color: var(--muted);
		font-size: 15px;
	}

	.group {
		margin: 0;
		padding: 0;
		/* Not `hidden`: that would make it a scroll container, which eats the rows' scroll-margin. */
		overflow: clip;
		border-radius: 12px;
		background: var(--group);
		list-style: none;
	}

	.item {
		/* scrollIntoView leaves this much clear, above the bar. */
		scroll-margin: 80px 0 calc(210px + env(safe-area-inset-bottom));
	}

	.item + .item {
		border-top: 1px solid var(--border);
	}

	label {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 13px 16px;
		cursor: pointer;
	}

	label:active {
		background: var(--hover);
	}

	/* The real checkbox stays for keyboards and screen readers; `.box` is what is seen. */
	input {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
		pointer-events: none;
	}

	.box {
		display: grid;
		flex: none;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 2px solid var(--faint);
		border-radius: 7px;
		color: transparent;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	input:checked + .box {
		border-color: var(--accent);
		background: var(--accent);
		color: #fff;
	}

	input:focus-visible + .box {
		outline: 2px solid var(--link);
		outline-offset: 2px;
	}

	.text {
		flex: 1;
		min-width: 0;
		font-size: 17px;
		line-height: 22px;
		overflow-wrap: anywhere;
	}

	.done .text {
		color: var(--faint);
		text-decoration: line-through;
	}

	.empty {
		padding: 40px 12px;
		text-align: center;
	}

	.empty-title {
		margin: 0 0 8px;
		font-size: 17px;
		font-weight: 600;
	}

	.empty-text {
		margin: 0 auto;
		max-width: 320px;
		color: var(--muted);
		line-height: 1.45;
	}

	.examples {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 16px 0 0;
		padding: 0;
		color: var(--muted);
		font-style: italic;
		list-style: none;
	}
</style>
