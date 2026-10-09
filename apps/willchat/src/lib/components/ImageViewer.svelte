<script lang="ts">
	import { onMount } from 'svelte';
	import { HomeButton } from '@leo-os/shared';
	import { t } from '$lib/i18n';
	import { saveImage } from '$lib/images';
	import Icon from './Icon.svelte';

	let { src, onclose }: { src: string; onclose: () => void } = $props();

	let dialog: HTMLDialogElement;
	let stage: HTMLElement;

	onMount(() => dialog.showModal());
</script>

<dialog
	bind:this={dialog}
	{onclose}
	onclick={(event) => {
		if (event.target === dialog || event.target === stage) dialog.close();
	}}
>
	<!-- It fills the screen, so the way home is here too, where the chat has it. -->
	<div class="toolbar">
		<button onclick={() => dialog.close()} aria-label={t.close} title={t.close}>
			<Icon name="close" />
		</button>
		<div class="end">
			<button onclick={() => saveImage(src)}>
				<Icon name="download" />
				{t.save}
			</button>
			<HomeButton label={t.apps} />
		</div>
	</div>
	<div class="stage" bind:this={stage}>
		<img {src} alt="" />
	</div>
</dialog>

<style>
	dialog {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		background: #000;
		color: #fff;
	}

	dialog::backdrop {
		background: transparent;
	}

	.toolbar {
		display: flex;
		flex: none;
		justify-content: space-between;
		padding: calc(env(safe-area-inset-top) + 6px) max(10px, env(safe-area-inset-right)) 6px
			max(10px, env(safe-area-inset-left));
	}

	.end {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 8px 12px;
		border: 0;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.14);
		color: #fff;
		font-size: 15px;
		font-weight: 500;
	}

	.stage {
		display: grid;
		flex: 1;
		min-height: 0;
		place-items: center;
		padding: 8px 8px calc(env(safe-area-inset-bottom) + 16px);
	}

	img {
		max-width: 100%;
		max-height: 100%;
		border-radius: 8px;
		object-fit: contain;
	}
</style>
