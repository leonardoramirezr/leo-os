<script lang="ts" module>
	export interface Action {
		label: string;
		run: () => void;
		/** Red, for what cannot be undone. */
		danger?: boolean;
	}
</script>

<script lang="ts">
	// A short list of things to do with something, as iOS asks: «Eliminar», «Copiar enlace»… with
	// «Cancelar» at the end. Choosing one closes it first, then does it.
	let { open = $bindable(), actions }: { open: boolean; actions: Action[] } = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function choose(action: Action) {
		open = false;
		action.run();
	}
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(event) => {
		if (event.target === dialog) dialog.close();
	}}
>
	<div class="actions">
		{#each actions as action (action.label)}
			<button type="button" class:danger={action.danger} onclick={() => choose(action)}>
				{action.label}
			</button>
		{/each}
		<button type="button" class="cancel" onclick={() => (open = false)}>Cancelar</button>
	</div>
</dialog>

<style>
	dialog {
		width: min(400px, calc(100% - 32px));
		padding: 0;
		border: 0;
		border-radius: 12px;
		background: var(--sheet);
	}

	.actions {
		display: flex;
		flex-direction: column;
	}

	button {
		min-height: 48px;
		padding: 4px 16px;
		border: 0;
		border-bottom: 1px solid var(--border);
		background: none;
		font-size: 14px;
	}

	button:last-child {
		border-bottom: 0;
	}

	.danger {
		color: var(--danger);
		font-weight: 700;
	}

	.cancel {
		color: var(--text);
	}
</style>
