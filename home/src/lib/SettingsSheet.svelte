<script lang="ts">
	import { AccountPanel, theme, type Theme } from '@leo-os/shared';
	import { tick } from 'svelte';
	import { BUILT_IN_STATUS_BAR } from '$lib/color';
	import ColorPicker from '$lib/ColorPicker.svelte';
	import Segmented from '$lib/Segmented.svelte';
	import { statusBar, ui, wallpaper } from '$lib/settings.svelte';
	import { prepareWallpaper } from '$lib/wallpaper';

	let { open = $bindable() }: { open: boolean } = $props();

	const THEMES: [Theme, string][] = [
		['light', 'Claro'],
		['dark', 'Oscuro'],
		['system', 'Sistema']
	];

	let dialog: HTMLDialogElement;
	let picker: HTMLInputElement;
	let busy = $state(false);
	let error = $state('');
	let closing = $state(false);
	/** Ajustes itself, or the page it opens for the status bar's colour. */
	let page = $state<'main' | 'status-bar'>('main');

	const barColor = $derived(ui.statusBarTrial || statusBar.value || BUILT_IN_STATUS_BAR);

	$effect(() => {
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	/** Slides the sheet down before closing it, as iOS does: at once when there is no animation. */
	async function dismiss() {
		if (closing || !dialog.open) return;

		closing = true;
		await tick();
		await Promise.allSettled(dialog.getAnimations().map((animation) => animation.finished));
		dialog.close();
		closing = false;
	}

	async function pick(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		// Let the same photo be picked again after a failure.
		event.currentTarget.value = '';
		if (!file) return;

		busy = true;
		error = '';
		try {
			wallpaper.value = await prepareWallpaper(file);
			// The photo is on screen either way; it is only the keeping of it that may have failed.
			if (!wallpaper.stored) {
				error = 'La imagen se aplicó, pero no se pudo guardar: se perderá al recargar.';
			}
		} catch {
			error = 'No se pudo usar esa imagen.';
		} finally {
			busy = false;
		}
	}

	function reset() {
		error = '';
		wallpaper.value = '';
	}

	/** Keeps a colour for the status bar. Every change is a write, so only a real one goes out. */
	function keepBarColor(color: string) {
		ui.statusBarTrial = '';
		if (color !== statusBar.value) statusBar.value = color;
	}

	/** Back to Ajustes, dropping a colour that was being tried and not kept. */
	function back() {
		ui.statusBarTrial = '';
		page = 'main';
	}
</script>

<dialog
	bind:this={dialog}
	class:closing
	aria-label="Ajustes"
	onclose={() => {
		open = false;
		back();
	}}
	oncancel={(event) => {
		event.preventDefault();
		dismiss();
	}}
	onclick={(event) => {
		if (event.target === dialog) dismiss();
	}}
>
	<div class="sheet">
		{#if page === 'main'}
			<header>
				<h2>Ajustes</h2>
				<button class="done" onclick={dismiss}>Listo</button>
			</header>

			<h3>Fondo de pantalla</h3>
			<div class="group">
				<div class="wallpaper">
					<span
						class="preview"
						class:custom={wallpaper.value}
						style:background-image={wallpaper.value ? `url(${wallpaper.value})` : undefined}
					></span>
					<div class="actions">
						<button onclick={() => picker.click()} disabled={busy}>
							{busy ? 'Preparando…' : 'Elegir foto'}
						</button>
						{#if wallpaper.value}
							<button class="danger" onclick={reset} disabled={busy}>Quitar</button>
						{/if}
					</div>
				</div>
			</div>
			<p class="hint" class:error>
				{error || 'La imagen se guarda en este navegador y se reduce para que quepa.'}
			</p>

			<h3>Apariencia</h3>
			<div class="group padded">
				<Segmented label="Tema" options={THEMES} bind:value={theme.value} />
			</div>
			<p class="hint">
				Se aplica al inicio y a todas las apps. «Sistema» sigue el modo claro u oscuro del
				dispositivo.
			</p>

			<h3>Barra de estado</h3>
			<div class="group">
				<button class="row" onclick={() => (page = 'status-bar')}>
					<span class="swatch" style:background-color={barColor}></span>
					<span class="label">Color</span>
					<span class="value">
						{statusBar.value ? statusBar.value.toUpperCase() : 'Predeterminado'}
					</span>
					<svg class="chevron" viewBox="0 0 8 14" width="8" height="14" aria-hidden="true">
						<path d="M1.5 1.5 6.5 7l-5 5.5" />
					</svg>
				</button>
			</div>
			<p class="hint">La franja de arriba, a la altura de la cámara.</p>

			<AccountPanel />
		{:else}
			<header>
				<button class="back" onclick={back}>
					<svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true">
						<path d="M10 2 2 10l8 8" />
					</svg>
					Ajustes
				</button>
				<h2>Barra de estado</h2>
				<button class="done" onclick={dismiss}>Listo</button>
			</header>

			<!-- The bar as iOS draws it over this colour: the clock and the camera, in white. -->
			<div class="bar" style:background-color={barColor} aria-hidden="true">
				<span class="time">9:41</span>
				<span class="island"></span>
				<span class="battery"></span>
			</div>

			<ColorPicker
				value={statusBar.value || BUILT_IN_STATUS_BAR}
				oninput={(color) => (ui.statusBarTrial = color)}
				onchange={keepBarColor}
			/>

			{#if statusBar.value}
				<div class="group reset">
					<button class="row" onclick={() => keepBarColor('')}>Usar el predeterminado</button>
				</div>
			{/if}
		{/if}
	</div>
</dialog>

<input
	bind:this={picker}
	type="file"
	accept="image/*"
	hidden
	aria-label="Elegir foto"
	onchange={pick}
/>

<style>
	dialog {
		/* iOS's grouped settings, light or dark with the theme. AccountPanel reads these too. */
		--text: light-dark(#000000, #ffffff);
		--muted: light-dark(#6d6d72, #98989f);
		--faint: light-dark(#c4c4c7, #5a5a5f);
		--group: light-dark(#ffffff, #2c2c2e);
		--separator: light-dark(#c6c6c8, #38383a);
		--fill: light-dark(rgb(118 118 128 / 0.12), rgb(118 118 128 / 0.24));
		--thumb: light-dark(#ffffff, #636366);
		--link: light-dark(#007aff, #0a84ff);
		--danger: light-dark(#ff3b30, #ff453a);

		width: 100%;
		max-width: 100%;
		max-height: 90dvh;
		margin: auto 0 0;
		padding: 0;
		border: 0;
		border-radius: 20px 20px 0 0;
		background: light-dark(#f2f2f7, #1c1c1e);
		color: var(--text);
		font-family: inherit;
		overscroll-behavior: contain;
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}

	/* In from below and back down, on the curve of an iOS sheet, while what is behind dims. */
	dialog[open] {
		animation: sheet-in 0.45s cubic-bezier(0.32, 0.72, 0, 1);
	}

	dialog[open]::backdrop {
		animation: fade-in 0.45s ease;
	}

	dialog.closing {
		animation: sheet-out 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards;
	}

	dialog.closing::backdrop {
		animation: fade-out 0.3s ease forwards;
	}

	@keyframes sheet-in {
		from {
			transform: translateY(100%);
		}
	}

	@keyframes sheet-out {
		to {
			transform: translateY(100%);
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	@keyframes fade-out {
		to {
			opacity: 0;
		}
	}

	@media (min-width: 640px) {
		dialog {
			width: 440px;
			margin: auto;
			border-radius: 20px;
		}

		/* A card in the middle of the screen, which comes up from its bottom edge like an iPad's. */
		dialog[open] {
			animation-name: card-in;
		}

		dialog.closing {
			animation-name: card-out;
		}
	}

	@keyframes card-in {
		from {
			transform: translateY(100vh);
		}
	}

	@keyframes card-out {
		to {
			transform: translateY(100vh);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		dialog[open],
		dialog[open]::backdrop {
			animation: none;
		}
	}

	.sheet {
		padding: 0 16px calc(24px + env(safe-area-inset-bottom));
	}

	header {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px 0 8px;
	}

	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
	}

	.done {
		position: absolute;
		right: 0;
		padding: 4px;
		font-weight: 600;
	}

	.back {
		position: absolute;
		left: -8px;
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 4px;
	}

	.back svg,
	.chevron {
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.back svg {
		stroke-width: 2.5;
	}

	h3 {
		margin: 20px 16px 8px;
		color: var(--muted);
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.group {
		overflow: hidden;
		border-radius: 12px;
		background: var(--group);
	}

	.group.padded {
		padding: 12px 16px;
	}

	.wallpaper {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 16px;
	}

	/* Same artwork as the home screen's default background, in miniature. */
	.preview {
		flex: none;
		width: 54px;
		height: 78px;
		border-radius: 10px;
		background:
			radial-gradient(90% 55% at 0% 0%, rgb(255 150 90 / 0.95), transparent 70%),
			radial-gradient(80% 50% at 100% 18%, rgb(240 70 160 / 0.9), transparent 70%),
			radial-gradient(100% 60% at 0% 100%, rgb(40 120 255 / 0.9), transparent 70%),
			radial-gradient(90% 55% at 100% 85%, rgb(130 70 240 / 0.95), transparent 70%),
			linear-gradient(170deg, #4a2a8a, #1c1446);
		box-shadow: inset 0 0 0 1px light-dark(rgb(0 0 0 / 0.08), rgb(255 255 255 / 0.12));
	}

	.preview.custom {
		background-position: center;
		background-size: cover;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}

	button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font: inherit;
		font-size: 17px;
		cursor: pointer;
	}

	button:disabled {
		color: var(--muted);
		cursor: default;
	}

	.danger:enabled {
		color: var(--danger);
	}

	/* A row of a settings list: what it is on the left, what it holds and where it leads on the right. */
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 44px;
		padding: 10px 16px;
		color: var(--text);
		text-align: left;
	}

	.row:active {
		background: var(--fill);
	}

	.swatch {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.3);
	}

	.label {
		flex: 1;
	}

	.value {
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.chevron {
		color: var(--faint);
		stroke-width: 2;
	}

	.reset {
		margin-top: 20px;
	}

	.reset .row {
		justify-content: center;
		color: var(--link);
	}

	/* The top of the phone in miniature: the clock, the camera and the battery, in white as iOS draws
	   them over the translucent bar the site asks for. */
	.bar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		height: 52px;
		margin: 8px 0 16px;
		padding: 0 28px;
		border-radius: 16px;
		box-shadow: inset 0 0 0 1px rgb(128 128 128 / 0.3);
		color: #fff;
	}

	.time {
		font-size: 16px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.island {
		width: 96px;
		height: 28px;
		border-radius: 14px;
		background: #000;
	}

	.battery {
		position: relative;
		justify-self: end;
		width: 25px;
		height: 12px;
		border-radius: 4px;
		background: #fff;
		box-shadow: 0 0 0 1.5px rgb(255 255 255 / 0.4);
	}

	.battery::after {
		content: '';
		position: absolute;
		top: 4px;
		right: -4px;
		width: 1.5px;
		height: 4px;
		border-radius: 0 1px 1px 0;
		background: rgb(255 255 255 / 0.4);
	}

	.hint {
		margin: 8px 16px 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.35;
	}

	.hint.error {
		color: var(--danger);
	}
</style>
