<script lang="ts">
	import { resolve } from '$app/paths';
	import { HomeButton } from '@leo-os/shared';
	import icon from '../../../icon.svg';
	import { t } from '$lib/i18n';
	import { fetchModelIds } from '$lib/models';
	import { OpenAIError } from '$lib/openai';
	import { apiKey, availableModels } from '$lib/settings.svelte';

	let key = $state('');
	let checking = $state(false);
	let error = $state('');

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		const value = key.trim();
		if (!value || checking) return;

		checking = true;
		error = '';
		try {
			availableModels.value = await fetchModelIds(value);
			apiKey.value = value;
		} catch (e) {
			if (e instanceof OpenAIError && e.status === 401) error = t.invalidKey;
			else if (e instanceof OpenAIError && e.status === 0) error = t.networkError;
			// Restricted keys may not be allowed to list models but can still create responses.
			else apiKey.value = value;
		} finally {
			checking = false;
		}
	}
</script>

<div class="screen">
	<header>
		<HomeButton href="{resolve('/')}../" />
	</header>

	<main class="onboarding">
		<form {onsubmit}>
			<img class="logo" src={icon} alt="" width="72" height="72" />
			<h1>{t.welcomeTitle}</h1>
			<p class="lead">{t.welcomeText}</p>

			<label>
				<span>{t.apiKey}</span>
				<input
					type="password"
					name="openai-api-key"
					placeholder="sk-…"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					bind:value={key}
				/>
			</label>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<button type="submit" disabled={checking || !key.trim()}>
				{checking ? t.checkingKey : t.continue}
			</button>

			<p class="hint">
				{t.keyPrivacy}
				<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
					{t.getApiKey}
				</a>
			</p>
		</form>
	</main>
</div>

<style>
	.screen {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	/* The bar every screen has along its top edge, stuck there, with the way home. */
	header {
		position: sticky;
		z-index: 10;
		top: 0;
		display: flex;
		padding: calc(env(safe-area-inset-top) + 6px) max(10px, env(safe-area-inset-right)) 6px
			max(10px, env(safe-area-inset-left));
		background: var(--bg);
	}

	.onboarding {
		display: grid;
		flex: 1;
		place-items: center;
		padding: 24px 20px calc(env(safe-area-inset-bottom) + 24px);
	}

	form {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 380px;
		text-align: center;
	}

	.logo {
		align-self: center;
		border-radius: 22.5%;
		box-shadow: var(--shadow);
	}

	h1 {
		margin: 20px 0 8px;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.lead {
		margin: 0 0 28px;
		color: var(--muted);
		line-height: 1.5;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		text-align: left;
	}

	label span {
		font-size: 14px;
		font-weight: 500;
	}

	input {
		width: 100%;
		padding: 13px 14px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--surface);
		font-size: 16px;
		font-family: var(--mono);
	}

	input:focus {
		border-color: var(--text);
		outline: none;
	}

	.error {
		margin: 10px 0 0;
		color: var(--danger);
		font-size: 14px;
		text-align: left;
	}

	button {
		margin-top: 16px;
		padding: 14px;
		border: 0;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-text);
		font-size: 16px;
		font-weight: 600;
	}

	button:disabled {
		opacity: 0.4;
	}

	.hint {
		margin: 20px 0 0;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.5;
	}

	.hint a {
		color: var(--text);
		font-weight: 500;
		white-space: nowrap;
	}
</style>
