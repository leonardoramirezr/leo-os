<script lang="ts">
	import icon from '../../../icon.svg';
	import { pushState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { prompts, titleOf, type Prompt } from '$lib/prompts.svelte';
	import Icon from './Icon.svelte';
	import PromptSheet from './PromptSheet.svelte';
	import SettingsSheet from './SettingsSheet.svelte';

	let creating = $state(false);
	let settingsOpen = $state(false);

	function open(prompt: Prompt) {
		pushState('', { prompt: prompt.id });
	}
</script>

<div class="screen">
	<header class="bar">
		<a class="icon-button" href="{resolve('/')}../" aria-label="Apps" title="Apps" data-sveltekit-reload>
			<Icon name="apps" />
		</a>
		<button
			class="icon-button"
			onclick={() => (settingsOpen = true)}
			aria-label="Ajustes"
			title="Ajustes"
			aria-haspopup="dialog"
		>
			<Icon name="settings" />
		</button>
	</header>

	<h1>Transforma</h1>

	{#if prompts.list.length}
		<p class="caption">Elige cómo transformar tu texto.</p>

		<ul class="prompts">
			{#each prompts.sorted as prompt (prompt.id)}
				<li>
					<button class="prompt" onclick={() => open(prompt)}>
						<span class="text">
							<span class="title">{titleOf(prompt)}</span>
							<span class="instructions">{prompt.instructions}</span>
						</span>
						<span class="chevron"><Icon name="forward" size={18} /></span>
					</button>
				</li>
			{/each}
			<li>
				<button class="prompt add" onclick={() => (creating = true)} aria-haspopup="dialog">
					<Icon name="plus" />
					Nuevo prompt
				</button>
			</li>
		</ul>
	{:else}
		<div class="empty">
			<img class="logo" src={icon} alt="" width="84" height="84" />
			<p class="empty-title">Crea tu primer prompt</p>
			<p class="empty-text">
				Un prompt dice cómo transformar un texto: hacerlo formal, corregirlo, adaptarlo a quien lo va a
				leer. Después lo eliges, pegas o escribes el texto, y Groq lo transforma.
			</p>
			<button class="primary" onclick={() => (creating = true)} aria-haspopup="dialog">Nuevo prompt</button>
		</div>
	{/if}
</div>

<PromptSheet bind:open={creating} oncreate={open} />
<SettingsSheet bind:open={settingsOpen} />

<style>
	.screen {
		max-width: 560px;
		margin: 0 auto;
		padding: 0 16px calc(32px + env(safe-area-inset-bottom));
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: 0 -8px;
		padding-top: calc(env(safe-area-inset-top) + 6px);
	}

	h1 {
		margin: 2px 4px 0;
		font-size: 34px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.caption {
		margin: 2px 4px 20px;
		color: var(--muted);
		font-size: 15px;
	}

	.prompts {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.prompt {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 74px;
		padding: 14px 12px 14px 18px;
		border: 0;
		border-radius: 18px;
		background: var(--group);
		box-shadow: var(--shadow);
		text-align: left;
		transition: transform 0.12s;
	}

	.prompt:active {
		transform: scale(0.98);
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
	}

	.title {
		overflow: hidden;
		font-size: 17px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Two lines of it: enough to tell two prompts with a similar name apart. */
	.instructions {
		display: -webkit-box;
		overflow: hidden;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.35;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.chevron {
		color: var(--faint);
	}

	.prompt.add {
		justify-content: center;
		gap: 8px;
		min-height: 56px;
		border: 1.5px dashed var(--border);
		background: transparent;
		box-shadow: none;
		color: var(--tint);
		font-size: 16px;
		font-weight: 600;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 12px;
		text-align: center;
	}

	.logo {
		border-radius: 22.5%;
		box-shadow: var(--shadow);
	}

	.empty-title {
		margin: 20px 0 8px;
		font-size: 20px;
		font-weight: 700;
	}

	.empty-text {
		max-width: 330px;
		margin: 0 0 24px;
		color: var(--muted);
		line-height: 1.5;
	}

	.empty .primary {
		max-width: 280px;
	}
</style>
