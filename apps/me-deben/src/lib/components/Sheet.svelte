<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Left corner of the header, usually «Cancelar» or «Atrás». */
		leading?: Snippet;
		/** Right corner, usually «Listo». */
		trailing?: Snippet;
		children: Snippet;
	}

	let { open = $bindable(), title, leading, trailing, children }: Props = $props();

	let dialog: HTMLDialogElement;

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-label={title}
	onclose={() => (open = false)}
	onclick={(event) => {
		if (event.target === dialog) dialog.close();
	}}
>
	<div class="sheet">
		<header>
			<div class="side">{#if leading}{@render leading()}{/if}</div>
			<h2>{title}</h2>
			<div class="side end">{#if trailing}{@render trailing()}{/if}</div>
		</header>

		<div class="body">
			{@render children()}
		</div>
	</div>
</dialog>

<style>
	dialog {
		width: 100%;
		max-width: 100%;
		max-height: 92dvh;
		margin: auto 0 0;
		padding: 0;
		border: 0;
		border-radius: 20px 20px 0 0;
		background: var(--sheet);
		overscroll-behavior: contain;
	}

	@media (min-width: 640px) {
		dialog {
			width: 460px;
			max-height: 80dvh;
			margin: auto;
			border-radius: 20px;
		}
	}

	.sheet {
		display: flex;
		max-height: inherit;
		flex-direction: column;
	}

	header {
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
		padding: 16px;
		background: var(--sheet);
	}

	h2 {
		flex: 1;
		margin: 0;
		font-size: 17px;
		font-weight: 600;
		text-align: center;
	}

	/* Both sides are the same width so the title is truly centered. */
	.side {
		display: flex;
		width: 76px;
		flex: none;
	}

	.side.end {
		justify-content: flex-end;
	}

	.body {
		flex: 1;
		padding: 0 16px calc(24px + env(safe-area-inset-bottom));
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
