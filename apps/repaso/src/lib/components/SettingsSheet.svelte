<script lang="ts">
	import { AccountPanel } from '@leo-os/shared';
	import { apiKey } from '$lib/settings.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable() }: { open: boolean } = $props();

	const maskedKey = $derived(`${apiKey.value.slice(0, 7)}…${apiKey.value.slice(-4)}`);

	function removeKey() {
		const question =
			'¿Quitar la API key de Groq guardada en tu cuenta? ' +
			'También dejará de usarse en las demás apps que usan Groq.';
		if (confirm(question)) apiKey.value = '';
	}
</script>

<Sheet bind:open title="Ajustes">
	{#snippet trailing()}
		<button class="text-button strong" type="button" onclick={() => (open = false)}>Listo</button>
	{/snippet}

	<h3>API key de Groq</h3>
	<div class="group">
		<div class="row">
			{#if apiKey.value}
				<code>{maskedKey}</code>
				<button class="danger" type="button" onclick={removeKey}>Quitar</button>
			{:else}
				<span class="muted">Se pide la primera vez que generas tarjetas con IA.</span>
			{/if}
		</div>
	</div>

	<AccountPanel />
</Sheet>

<style>
	h3 {
		margin: 4px 16px 8px;
		color: var(--muted);
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0.02em;
		text-transform: uppercase;
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

	code {
		color: var(--muted);
		font-family: var(--mono);
		font-size: 14px;
	}

	.muted {
		color: var(--muted);
		font-size: 15px;
		line-height: 1.4;
	}

	.danger {
		padding: 0;
		border: 0;
		background: none;
		color: var(--danger);
		font-size: 16px;
	}
</style>
