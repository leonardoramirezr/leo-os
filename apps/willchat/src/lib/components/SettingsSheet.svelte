<script lang="ts">
	import { untrack } from 'svelte';
	import { AccountPanel } from '@leo-os/shared';
	import { GroqError, listModels, TRANSCRIPTION_MODEL } from '$lib/groq';
	import { lang, t } from '$lib/i18n';
	import { fetchModelIds, imageModelOptions, textModelOptions } from '$lib/models';
	import { apiKey, availableModels, groqKey, imageModel, textModel } from '$lib/settings.svelte';
	import ModelSelect from './ModelSelect.svelte';

	let { open = $bindable(), onchangekey }: { open: boolean; onchangekey: () => void } = $props();

	let dialog: HTMLDialogElement;
	let modelsRefreshed = false;

	let groqDraft = $state('');
	let checkingGroq = $state(false);
	let groqProblem = $state('');

	const maskedKey = $derived(`${apiKey.value.slice(0, 7)}…${apiKey.value.slice(-4)}`);
	const maskedGroqKey = $derived(`${groqKey.value.slice(0, 7)}…${groqKey.value.slice(-4)}`);

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

	async function saveGroqKey(event: SubmitEvent) {
		event.preventDefault();
		const value = groqDraft.trim();
		if (!value || checkingGroq) return;

		// An OpenAI key, like the one WillChat chats with, is no good to Groq, and not Groq's to see.
		if (value.startsWith('sk-')) {
			groqProblem = t.notAGroqKey;
			return;
		}

		checkingGroq = true;
		groqProblem = '';
		try {
			await listModels(value);
			groqKey.value = value;
		} catch (error) {
			if (error instanceof GroqError && error.status === 401) groqProblem = t.invalidGroqKey;
			else if (error instanceof GroqError && error.status === 0) groqProblem = t.groqNetworkError;
			// A key that may not list the models may still transcribe.
			else groqKey.value = value;
		} finally {
			checkingGroq = false;
		}
	}

	function changeGroqKey() {
		if (!confirm(t.confirmChangeGroqKey)) return;
		groqDraft = '';
		groqProblem = '';
		groqKey.value = '';
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
			<div class="fixed">
				<span>{t.speechToText}</span>
				<span class="value">{TRANSCRIPTION_MODEL}</span>
			</div>
		</div>

		<h3>{t.apiKey}</h3>
		<div class="group">
			<div class="key">
				<code>{maskedKey}</code>
				<button onclick={changeKey}>{t.changeKey}</button>
			</div>
		</div>

		<h3>{t.groqApiKey}</h3>
		<div class="group">
			{#if groqKey.value}
				<div class="key">
					<code>{maskedGroqKey}</code>
					<button onclick={changeGroqKey}>{t.changeKey}</button>
				</div>
			{:else}
				<form class="entry" onsubmit={saveGroqKey}>
					<input
						type="password"
						name="groq-api-key"
						placeholder="gsk_…"
						aria-label={t.groqApiKey}
						autocomplete="off"
						autocapitalize="off"
						spellcheck="false"
						bind:value={groqDraft}
					/>
					<button type="submit" disabled={checkingGroq || !groqDraft.trim()}>
						{checkingGroq ? t.checkingKey : t.save}
					</button>
				</form>
			{/if}
		</div>
		{#if !groqKey.value}
			{#if groqProblem}
				<p class="note problem" role="alert">{groqProblem}</p>
			{/if}
			<p class="note">
				{t.groqKeyHint}
				<a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
					{t.getApiKey}
				</a>
			</p>
		{/if}

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

	/* A model that is shown, not chosen: laid out like the ones above it. */
	.fixed {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 16px;
		border-top: 1px solid var(--border);
	}

	.value {
		overflow: hidden;
		color: var(--muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
	}

	.entry input {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		outline: none;
		background: transparent;
		font-family: var(--mono);
		font-size: 16px;
	}

	.entry input::placeholder {
		color: var(--muted);
	}

	.entry button {
		flex: none;
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 16px;
		font-weight: 600;
	}

	.entry button:disabled {
		opacity: 0.4;
	}

	.note {
		margin: 8px 16px 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.45;
	}

	.note a {
		color: var(--text);
		font-weight: 500;
		white-space: nowrap;
	}

	.problem {
		color: var(--danger);
	}
</style>
