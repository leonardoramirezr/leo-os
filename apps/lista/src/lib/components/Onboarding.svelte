<script lang="ts">
	import icon from '../../../icon.svg';
	import { GroqError, listModels } from '$lib/groq';
	import { apiKey } from '$lib/settings.svelte';

	const OFFLINE = 'No se pudo conectar con Groq. Revisa tu conexión e inténtalo de nuevo.';

	let key = $state('');
	let checking = $state(false);
	let error = $state('');

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		const value = key.trim();
		if (!value || checking) return;

		// An OpenAI key, WillChat's say, is no good to Groq, and it is not Groq's to see either.
		if (value.startsWith('sk-')) {
			error =
				'Esa parece una API key de OpenAI, como la de WillChat. ' +
				'Groq usa las suyas, que empiezan con gsk_.';
			return;
		}

		checking = true;
		error = '';
		try {
			await listModels(value);
			apiKey.value = value;
		} catch (e) {
			if (e instanceof GroqError && e.status === 401) error = 'Groq rechazó esta API key.';
			else if (e instanceof GroqError && e.status === 0) error = OFFLINE;
			// A key that may not list the models may still transcribe and chat.
			else apiKey.value = value;
		} finally {
			checking = false;
		}
	}
</script>

<main class="onboarding">
	<form {onsubmit}>
		<img class="logo" src={icon} alt="" width="72" height="72" />
		<h1>Lista</h1>
		<p class="lead">
			Dicta una lista y cámbiala hablando. Groq pasa tu voz a texto y decide qué agregar, cambiar o
			quitar. Para empezar, ingresa tu API key de Groq.
		</p>

		<label>
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

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<button type="submit" disabled={checking || !key.trim()}>
			{checking ? 'Verificando…' : 'Continuar'}
		</button>

		<p class="hint">
			Esta API key se usa en esta app y en las demás apps de Leo OS que usen Groq: la ingresas una sola
			vez. Se guarda en tu cuenta, donde solo tú puedes leerla, y solo se envía a api.groq.com, igual que
			lo que grabes.
			<a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
				Obtener una API key
			</a>
		</p>
	</form>
</main>

<style>
	.onboarding {
		display: grid;
		place-items: center;
		min-height: 100dvh;
		padding: calc(env(safe-area-inset-top) + 24px) 20px calc(env(safe-area-inset-bottom) + 24px);
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
		background: var(--group);
		font-size: 16px;
		font-family: var(--mono);
	}

	input:focus {
		border-color: var(--accent);
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
		border-radius: 12px;
		background: var(--accent);
		color: #fff;
		font-size: 17px;
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
