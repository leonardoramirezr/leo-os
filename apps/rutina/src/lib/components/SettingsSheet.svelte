<script lang="ts">
	import { untrack } from 'svelte';
	import { AccountPanel } from '@leo-os/shared';
	import { testAlarm } from '$lib/device';
	import { chatModels, listModels } from '$lib/groq';
	import { apiKey, model, models } from '$lib/settings.svelte';
	import GroqKeyField from './GroqKeyField.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable() }: { open: boolean } = $props();

	const maskedKey = $derived(`${apiKey.value.slice(0, 7)}…${apiKey.value.slice(-4)}`);

	// Asked for every time the sheet opens: Groq adds models and retires others.
	$effect(() => {
		if (open && apiKey.value) untrack(refreshModels);
	});

	async function refreshModels() {
		try {
			models.value = await listModels(apiKey.value);
		} catch {
			// The list known already stays. If something is wrong, importing will say what.
		}
	}

	function removeKey() {
		const question =
			'¿Quitar la API key de Groq guardada en tu cuenta? ' +
			'También dejará de usarse en las demás apps que usan Groq.';
		if (confirm(question)) apiKey.value = '';
	}
</script>

<Sheet bind:open title="Ajustes">
	{#snippet trailing()}
		<button class="text-button strong" type="button" onclick={() => (open = false)}>Listo</button>
	{/snippet}

	<h3 class="section-title first">Alarma</h3>
	<div class="group">
		<button class="row" type="button" onclick={testAlarm}>Probar el sonido</button>
	</div>
	<p class="hint">
		Suena al acabar el tiempo de una serie y el de un descanso, hasta que tocas el botón que sigue. En el
		iPhone, el interruptor de silencio también la silencia; la pantalla parpadea de todos modos.
	</p>

	<h3 class="section-title">Importar con IA</h3>
	{#if apiKey.value}
		<div class="group">
			<label class="field inline">
				<span>Modelo</span>
				<select bind:value={model.value}>
					{#each chatModels(models.value, model.value) as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			</label>
			<div class="row key">
				<code>{maskedKey}</code>
				<button class="danger" type="button" onclick={removeKey}>Quitar</button>
			</div>
		</div>
		<p class="hint">
			Al importar una rutina como JSON, el modelo de Groq decide a qué ejercicio de la app corresponde cada
			uno. La API key es la misma de las demás apps de Leo OS que usan Groq.
		</p>
	{:else}
		<GroqKeyField />
	{/if}

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
		width: 100%;
		min-height: 48px;
		padding: 12px 16px;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 17px;
		text-align: left;
	}

	.key {
		border-top: 1px solid var(--border);
		color: inherit;
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
