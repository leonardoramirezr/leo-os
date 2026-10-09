<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Left corner of the header, usually «Cancelar». */
		leading?: Snippet;
		/** Right corner, usually «Listo» or «Siguiente». */
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
			<h2 class="display">{title}</h2>
			<div class="side end">{#if trailing}{@render trailing()}{/if}</div>
		</header>

		<div class="body">
			{@render children()}
		</div>
	</div>
</dialog>

<style>
	/* A sheet of the same paper, slid up from the bottom, outlined in ink along its top. */
	dialog {
		width: 100%;
		max-width: 100%;
		height: 92dvh;
		max-height: 92dvh;
		margin: auto 0 0;
		padding: 0;
		border: 0;
		border-top: 3px solid var(--ink);
		border-radius: 24px 24px 0 0;
		background: var(--sheet);
		overscroll-behavior: contain;
		/* In the dark a sheet is the grey fields are: a field on it takes a lighter one. */
		--field: light-dark(#e4e4db, #30303a);
	}

	@media (min-width: 640px) {
		dialog {
			width: 480px;
			height: 80dvh;
			max-height: 80dvh;
			margin: auto;
			border: 3px solid var(--ink);
			border-radius: 24px;
			box-shadow: 6px 6px 0 var(--ink);
		}
	}

	.sheet {
		display: flex;
		height: 100%;
		flex-direction: column;
	}

	header {
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
		min-height: 54px;
		padding: 6px 12px;
		border-bottom: var(--line) solid var(--ink);
		background: var(--sheet);
	}

	h2 {
		flex: 1;
		margin: 0;
		font-size: 22px;
		text-align: center;
	}

	/* Both sides are the same width so the title is truly centered. */
	.side {
		display: flex;
		width: 88px;
		flex: none;
	}

	.side.end {
		justify-content: flex-end;
	}

	.body {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		padding: 0 0 env(safe-area-inset-bottom);
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
