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
	/* A card stuck on the page: outlined, on its hard shadow. */
	dialog {
		width: min(400px, calc(100% - 40px));
		padding: 0;
		overflow: visible;
		border: 3px solid var(--ink);
		border-radius: 18px;
		background: var(--sheet);
		box-shadow: 6px 6px 0 var(--ink);
	}

	.actions {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 15px;
	}

	button {
		min-height: 52px;
		padding: 4px 16px;
		border: 0;
		border-bottom: var(--line) solid var(--ink);
		background: none;
		font-size: 16px;
		font-weight: 600;
	}

	button:last-child {
		border-bottom: 0;
	}

	.danger {
		color: var(--danger);
		font-weight: 800;
	}

	.cancel {
		background: var(--lilac);
		color: var(--on-lilac);
		font-weight: 800;
	}
</style>
