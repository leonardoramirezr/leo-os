<script lang="ts">
	import { untrack } from 'svelte';
	import { AccountPanel } from '@leo-os/shared';
	import { chatModels, listModels, transcriptionModels } from '$lib/groq';
	import {
		apiKey,
		chatModel,
		language,
		models,
		transcriptionModel,
		type Language
	} from '$lib/settings.svelte';
	import { voice } from '$lib/voice.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable() }: { open: boolean } = $props();

	const LANGUAGES: [Language, string][] = [
		['es', 'Español'],
		['en', 'Inglés'],
		['', 'Automático']
	];

	const maskedKey = $derived(`${apiKey.value.slice(0, 7)}…${apiKey.value.slice(-4)}`);

	// Asked for every time the sheet opens: Groq adds models and retires others.
	$effect(() => {
		if (open && apiKey.value) untrack(refreshModels);
	});

	async function refreshModels() {
		try {
			models.value = await listModels(apiKey.value);
		} catch {
			// The list known already stays. If something is wrong, dictating will say what.
		}
	}

	function removeKey() {
		const question =
			'¿Quitar la API key de Groq guardada en tu cuenta? ' +
			'También dejará de usarse en las demás apps que usan Groq.';
		if (!confirm(question)) return;
		open = false;
		voice.changeKey();
	}
</script>

<Sheet bind:open title="Ajustes">
	{#snippet trailing()}
		<button class="text-button strong" type="button" onclick={() => (open = false)}>Listo</button>
	{/snippet}

	<h3 class="section-title first">Voz a texto</h3>
	<div class="group">
		<label class="field inline">
			<span>Modelo</span>
			<select bind:value={transcriptionModel.value}>
				{#each transcriptionModels(models.value, transcriptionModel.value) as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</label>
		<label class="field inline">
			<span>Idioma</span>
			<select bind:value={language.value}>
				{#each LANGUAGES as [code, name] (code)}
					<option value={code}>{name}</option>
				{/each}
			</select>
		</label>
	</div>
	<p class="hint">
		Pasa lo que dices a texto. Con el idioma en «Automático» lo adivina Whisper, que con pocas palabras
		puede equivocarse.
	</p>

	<h3 class="section-title">Mejorar y editar</h3>
	<div class="group">
		<label class="field inline">
			<span>Modelo</span>
			<select bind:value={chatModel.value}>
				{#each chatModels(models.value, chatModel.value) as option (option)}
					<option value={option}>{option}</option>
				{/each}
			</select>
		</label>
	</div>
	<p class="hint">
		Reescribe lo que dictas cuando «Mejorar texto» está encendido, y todo el texto cuando tocas
		«Mejorar». También hace los cambios que le pides con «Editar».
	</p>

	<h3 class="section-title">API key de Groq</h3>
	<div class="group">
		<div class="row">
			<code>{maskedKey}</code>
			<button class="danger" type="button" onclick={removeKey}>Quitar</button>
		</div>
	</div>

	<AccountPanel />
</Sheet>

<style>
	.first {
		margin-top: 4px;
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

	.danger {
		padding: 0;
		border: 0;
		background: none;
		color: var(--danger);
		font-size: 16px;
	}
</style>
