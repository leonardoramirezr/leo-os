<script lang="ts">
	import { untrack } from 'svelte';
	import { AccountPanel } from '@leo-os/shared';
	import { lang, t } from '$lib/i18n';
	import { fetchModelIds, imageModelOptions, textModelOptions } from '$lib/models';
	import { apiKey, availableModels, imageModel, textModel } from '$lib/settings.svelte';
	import ModelSelect from './ModelSelect.svelte';

	let { open = $bindable(), onchangekey }: { open: boolean; onchangekey: () => void } = $props();

	let dialog: HTMLDialogElement;
	let modelsRefreshed = false;

	const maskedKey = $derived(`${apiKey.value.slice(0, 7)}…${apiKey.value.slice(-4)}`);

	$effect(() => {
		if (open && !dialog.open) {
			dialog.showModal();
			untrack(refreshModels);
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	/** Refreshes the list of models once per visit, in case new ones became available. */
	async function refreshModels() {
		if (modelsRefreshed) return;
		modelsRefreshed = true;
		try {
			availableModels.value = await fetchModelIds(apiKey.value);
		} catch {
			modelsRefreshed = false;
		}
	}

	function changeKey() {
		if (!confirm(t.confirmChangeKey)) return;
		dialog.close();
		onchangekey();
	}
</script>

<dialog
	bind:this={dialog}
	aria-label={t.settings}
	onclose={() => (open = false)}
	onclick={(event) => {
		if (event.target === dialog) dialog.close();
	}}
>
	<div class="sheet">
		<header>
			<h2>{t.settings}</h2>
			<button class="done" onclick={() => dialog.close()}>{t.done}</button>
		</header>

		<h3>{t.models}</h3>
		<div class="group">
			<ModelSelect
				label={t.textModel}
				bind:value={textModel.value}
				options={textModelOptions(availableModels.value, textModel.value)}
			/>
			<ModelSelect
				label={t.imageModel}
				bind:value={imageModel.value}
				options={imageModelOptions(availableModels.value, imageModel.value)}
			/>
		</div>

		<h3>{t.apiKey}</h3>
		<div class="group">
			<div class="key">
				<code>{maskedKey}</code>
				<button onclick={changeKey}>{t.changeKey}</button>
			</div>
		</div>

		<AccountPanel {lang} />
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

	.key {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 16px;
	}

	code {
		color: var(--muted);
		font-family: var(--mono);
		font-size: 14px;
	}

	.key button {
		padding: 0;
		border: 0;
		background: none;
		color: var(--danger);
		font-size: 16px;
	}
</style>
