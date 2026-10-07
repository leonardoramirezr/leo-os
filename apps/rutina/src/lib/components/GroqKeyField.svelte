<script lang="ts">
	// Asks for the Groq API key the first time it is needed. It is checked against Groq before it is
	// kept, and kept in the account, where every app here that uses Groq finds it.
	import { GroqError, listModels } from '$lib/groq';
	import { apiKey, models } from '$lib/settings.svelte';

	let { onsaved }: { onsaved?: () => void } = $props();

	let key = $state('');
	let checking = $state(false);
	let error = $state('');

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		const value = key.trim();
		if (!value || checking) return;

		// An OpenAI key, WillChat's say, is no good to Groq, and it is not Groq's to see either.
		if (value.startsWith('sk-')) {
			error = 'Esa parece una API key de OpenAI, como la de WillChat. Groq usa las suyas, que empiezan con gsk_.';
			return;
		}

		checking = true;
		error = '';
		try {
			models.value = await listModels(value);
			apiKey.value = value;
			onsaved?.();
		} catch (e) {
			if (e instanceof GroqError && e.status === 401) error = 'Groq rechazó esta API key.';
			else if (e instanceof GroqError && e.status === 0) {
				error = 'No se pudo conectar con Groq. Revisa tu conexión e inténtalo de nuevo.';
			} else {
				// A key that may not list the models may still answer.
				apiKey.value = value;
				onsaved?.();
			}
		} finally {
			checking = false;
		}
	}
</script>

<form {onsubmit}>
	<div class="group">
		<label class="field">
			<span>API key de Groq</span>
			<input
				type="password"
				name="groq-api-key"
				placeholder="gsk_…"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				bind:value={key}
			/>
		</label>
	</div>
	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}
	<button class="primary" type="submit" disabled={checking || !key.trim()}>
		{checking ? 'Verificando…' : 'Guardar API key'}
	</button>
	<p class="hint">
		Con ella, un modelo de Groq arma la rutina que describes con tus palabras y empareja los ejercicios de una
		rutina pegada como JSON con los de la app. Es la misma API key de las demás apps de Leo OS que usan Groq:
		se guarda en tu cuenta, donde solo tú puedes leerla, y solo se envía a api.groq.com, junto con lo que
		describes o dictas, o los nombres de los ejercicios.
		<a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Obtener una API key</a>
	</p>
</form>

<style>
	.primary {
		margin-top: 12px;
	}

	a {
		color: var(--link);
	}
</style>
