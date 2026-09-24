<script lang="ts">
	import { AccountPanel } from '@leo-os/shared';
	import { LIST_MODEL, TRANSCRIPTION_MODEL } from '$lib/groq';
	import { apiKey } from '$lib/settings.svelte';
	import { voice } from '$lib/voice.svelte';

	let { open = $bindable() }: { open: boolean } = $props();

	let dialog: HTMLDialogElement;

	const maskedKey = $derived(`${apiKey.value.slice(0, 7)}…${apiKey.value.slice(-4)}`);

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function changeKey() {
		if (!confirm('¿Quitar la API key de Groq guardada en tu cuenta?')) return;
		dialog.close();
		voice.changeKey();
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

		<h3>API key de Groq</h3>
		<div class="group">
			<div class="row">
				<code>{maskedKey}</code>
				<button class="danger" onclick={changeKey}>Cambiar API key</button>
			</div>
		</div>

		<h3>Modelos</h3>
		<div class="group">
			<div class="row">
				<span>Voz a texto</span>
				<code>{TRANSCRIPTION_MODEL}</code>
			</div>
			<div class="row">
				<span>Decide los cambios</span>
				<code>{LIST_MODEL}</code>
			</div>
		</div>

		<AccountPanel />
	</div>
</dialog>

<style>
	dialog {
		width: 100%;
		max-width: 100%;
		max-height: 90dvh;
		margin: auto 0 0;
		padding: 0;
		border: 0;
		border-radius: 20px 20px 0 0;
		background: var(--sheet);
		overscroll-behavior: contain;
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
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px 0 8px;
		background: var(--sheet);
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
		border: 0;
		background: none;
		color: var(--link);
		font-size: 17px;
		font-weight: 600;
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

	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 4px 12px;
		min-height: 48px;
		padding: 12px 16px;
	}

	.row + .row {
		border-top: 1px solid var(--border);
	}

	code {
		color: var(--muted);
		font-family: var(--mono);
		font-size: 14px;
	}

	.danger {
		padding: 0;
		border: 0;
		background: none;
		color: var(--danger);
		font-size: 16px;
	}
</style>
