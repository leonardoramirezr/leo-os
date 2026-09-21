<script lang="ts">
	import { AccountPanel } from '@leo-os/shared';
	import { wallpaper } from '$lib/settings.svelte';
	import { prepareWallpaper } from '$lib/wallpaper';

	let { open = $bindable() }: { open: boolean } = $props();

	let dialog: HTMLDialogElement;
	let picker: HTMLInputElement;
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

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
</script>

<dialog
	bind:this={dialog}
	aria-label="Ajustes"
	onclose={() => (open = false)}
	onclick={(event) => {
		if (event.target === dialog) dialog.close();
	}}
>
	<div class="sheet">
		<header>
			<h2>Ajustes</h2>
			<button class="done" onclick={() => dialog.close()}>Listo</button>
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

		<AccountPanel />
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
		width: 100%;
		max-width: 100%;
		max-height: 90dvh;
		margin: auto 0 0;
		padding: 0;
		border: 0;
		border-radius: 20px 20px 0 0;
		background: #1c1c1e;
		color: #fff;
		font-family: inherit;
		overscroll-behavior: contain;
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}

	@media (min-width: 640px) {
		dialog {
			width: 440px;
			margin: auto;
			border-radius: 20px;
		}
	}

	.sheet {
		padding: 0 16px calc(24px + env(safe-area-inset-bottom));
	}

	header {
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
		right: 16px;
		padding: 4px;
		color: #0a84ff;
		font-weight: 600;
	}

	h3 {
		margin: 20px 16px 8px;
		color: #98989f;
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.group {
		overflow: hidden;
		border-radius: 12px;
		background: #2c2c2e;
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
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
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
		color: #0a84ff;
		font: inherit;
		font-size: 17px;
		cursor: pointer;
	}

	button:disabled {
		color: #98989f;
		cursor: default;
	}

	.danger:enabled {
		color: #ff453a;
	}

	.hint {
		margin: 8px 16px 0;
		color: #98989f;
		font-size: 13px;
		line-height: 1.35;
	}

	.hint.error {
		color: #ff453a;
	}
</style>
