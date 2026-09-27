<script lang="ts">
	import { untrack } from 'svelte';
	import { collection, type Deck, type Draft } from '$lib/collection.svelte';
	import { plural } from '$lib/format';
	import { LANGUAGES, writeCards, type Language } from '$lib/generate';
	import { chatModels, GroqError } from '$lib/groq';
	import { apiKey, language, model, models } from '$lib/settings.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable(), deck }: { open: boolean; deck: Deck } = $props();

	const COUNTS = [5, 10, 20];
	const LANGUAGE_NAMES: Record<Language, string> = { es: 'Español', en: 'Inglés' };
	const OFFLINE = 'No se pudo conectar con Groq. Revisa tu conexión e inténtalo de nuevo.';
	const EXAMPLE =
		'Un tema, una lista o tus apuntes. Por ejemplo: «verbos irregulares en inglés» o «los huesos de la mano».';

	let topic = $state('');
	let count = $state(10);
	let working = $state(false);
	let error = $state('');
	/** The error is Groq turning the key down: it comes with a way to change it. */
	let keyRefused = $state(false);
	/**
	 * What the model wrote, each with whether to keep it. They stay until added or discarded: closing
	 * the sheet by mistake does not throw away what took a while to write.
	 */
	let drafts = $state<(Draft & { keep: boolean })[]>([]);

	/** The key being typed, while there is none. */
	let key = $state('');
	let checking = $state(false);

	const kept = $derived(drafts.filter((draft) => draft.keep));
	const options = $derived(
		models.value.includes(model.value) ? models.value : [model.value, ...models.value]
	);

	// Asked for every time the sheet opens: Groq adds models and retires others.
	$effect(() => {
		if (open && apiKey.value) untrack(refreshModels);
	});

	async function refreshModels() {
		try {
			models.value = await chatModels(apiKey.value);
		} catch {
			// The list known already stays. If something is wrong, generating will say what.
		}
	}

	async function saveKey(event: SubmitEvent) {
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
			models.value = await chatModels(value);
			accept(value);
		} catch (e) {
			if (e instanceof GroqError && e.status === 401) error = 'Groq rechazó esta API key.';
			else if (e instanceof GroqError && e.status === 0) error = OFFLINE;
			// A key that may not list the models may still write cards.
			else accept(value);
		} finally {
			checking = false;
		}
	}

	function accept(value: string) {
		apiKey.value = value;
		key = '';
	}

	function changeKey() {
		error = '';
		keyRefused = false;
		apiKey.value = '';
	}

	async function generate(event: SubmitEvent) {
		event.preventDefault();
		const wanted = topic.trim();
		if (!wanted || working) return;

		working = true;
		error = '';
		keyRefused = false;
		try {
			const written = await writeCards(apiKey.value, model.value, {
				deck: deck.name,
				topic: wanted,
				count,
				language: language.value,
				existing: collection.cardsOf(deck.id).map((card) => card.front)
			});
			if (!written.length) {
				error = 'Groq no escribió tarjetas nuevas. Prueba con más detalle o con otro tema.';
			}
			drafts = written.map((draft) => ({ ...draft, keep: true }));
		} catch (e) {
			fail(e);
		} finally {
			working = false;
		}
	}

	function fail(e: unknown) {
		if (!(e instanceof GroqError)) {
			error = e instanceof Error && e.message ? e.message : 'Algo salió mal.';
			return;
		}

		keyRefused = e.status === 401;
		if (e.status === 0) error = OFFLINE;
		else if (e.status === 401) error = 'Groq rechazó la API key.';
		else if (e.status === 429) error = 'Groq pide esperar: tu API key llegó a su límite de uso por ahora.';
		else if (e.status === 413) error = 'El texto es demasiado largo. Recórtalo e inténtalo de nuevo.';
		else error = e.message;
	}

	function add() {
		collection.addCards(
			deck.id,
			kept.map(({ front, back }) => ({ front, back }))
		);
		drafts = [];
		topic = '';
		open = false;
	}
</script>

<Sheet bind:open title="Generar con IA">
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cerrar</button>
	{/snippet}

	{#if !apiKey.value}
		<form onsubmit={saveKey}>
			<p class="lead">
				Groq escribe las tarjetas por ti a partir de un tema o de tus apuntes. Para empezar, ingresa tu API
				key de Groq.
			</p>
			<div class="group">
				<label class="field">
					<span>API key de Groq</span>
					<input
						class="key"
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
				{checking ? 'Verificando…' : 'Continuar'}
			</button>

			<p class="hint">
				Esta API key se usa en esta app y en las demás apps de Leo OS que usen Groq: la ingresas una sola
				vez. Se guarda en tu cuenta, donde solo tú puedes leerla, y solo se envía a api.groq.com, junto
				con lo que pidas.
				<a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
					Obtener una API key
				</a>
			</p>
		</form>
	{:else if drafts.length}
		<p class="lead">
			{plural(drafts.length, 'tarjeta nueva', 'tarjetas nuevas')} para «{deck.name}». Toca las que no
			quieras.
		</p>

		<ul class="group drafts">
			{#each drafts as draft, index (index)}
				<li>
					<label class="draft" class:dropped={!draft.keep}>
						<input type="checkbox" bind:checked={draft.keep} />
						<span class="box" aria-hidden="true"><Icon name="check" size={14} stroke={3} /></span>
						<span class="text">
							<span class="front">{draft.front}</span>
							<span class="back">{draft.back}</span>
						</span>
					</label>
				</li>
			{/each}
		</ul>

		<button class="primary" type="button" onclick={add} disabled={!kept.length}>
			{kept.length ? `Añadir ${plural(kept.length, 'tarjeta', 'tarjetas')}` : 'Ninguna elegida'}
		</button>
		<button class="secondary" type="button" onclick={() => (drafts = [])}>Descartar y volver</button>
	{:else}
		<form onsubmit={generate}>
			<div class="group">
				<label class="field">
					<span>¿Qué quieres aprender?</span>
					<textarea
						bind:value={topic}
						rows="4"
						maxlength="20000"
						placeholder={EXAMPLE}
					></textarea>
				</label>

				<div class="field inline">
					<span id="count-label">Tarjetas</span>
					<div class="segmented" role="radiogroup" aria-labelledby="count-label">
						{#each COUNTS as option (option)}
							<label class:selected={count === option}>
								<input type="radio" name="count" value={option} bind:group={count} />
								{option}
							</label>
						{/each}
					</div>
				</div>

				<label class="field inline">
					<span>Idioma</span>
					<select bind:value={language.value}>
						{#each Object.keys(LANGUAGES) as Language[] as option (option)}
							<option value={option}>{LANGUAGE_NAMES[option]}</option>
						{/each}
					</select>
				</label>

				<label class="field inline">
					<span>Modelo</span>
					<select bind:value={model.value}>
						{#each options as option (option)}
							<option value={option}>{option}</option>
						{/each}
					</select>
				</label>
			</div>

			{#if error}
				<p class="error" role="alert">
					{error}
					{#if keyRefused}
						<button class="link" type="button" onclick={changeKey}>Cambiar API key</button>
					{/if}
				</p>
			{/if}

			<button class="primary generate" type="submit" disabled={working || !topic.trim()}>
				{#if working}
					<span class="spinner" aria-hidden="true"></span>
					Escribiendo tarjetas…
				{:else}
					<Icon name="sparkles" />
					Generar
				{/if}
			</button>
		</form>
	{/if}
</Sheet>

<style>
	.lead {
		margin: 0 4px 16px;
		color: var(--muted);
		font-size: 15px;
		line-height: 1.45;
	}

	.key {
		font-family: var(--mono);
	}

	.primary {
		margin-top: 16px;
	}

	.generate {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.secondary {
		display: block;
		width: 100%;
		margin-top: 8px;
		padding: 12px;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 17px;
	}

	.hint a {
		color: var(--text);
		font-weight: 500;
		white-space: nowrap;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: inherit;
		font-weight: 600;
	}

	.segmented {
		display: flex;
		padding: 2px;
		border-radius: 9px;
		background: color-mix(in srgb, var(--text) 8%, transparent);
	}

	.segmented label {
		min-width: 46px;
		padding: 5px 12px;
		border-radius: 7px;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
		text-align: center;
		cursor: pointer;
	}

	.segmented label.selected {
		background: var(--group);
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.12);
		font-weight: 600;
	}

	.segmented label:has(:focus-visible) {
		outline: 2px solid var(--link);
		outline-offset: 1px;
	}

	/* The real inputs stay for keyboards and screen readers; what is seen is drawn around them. */
	.segmented input,
	.draft input {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
		pointer-events: none;
	}

	.drafts li + li {
		border-top: 1px solid var(--border);
	}

	.draft {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 16px;
		cursor: pointer;
	}

	.box {
		display: grid;
		flex: none;
		place-items: center;
		width: 22px;
		height: 22px;
		margin-top: 1px;
		border: 2px solid var(--accent);
		border-radius: 50%;
		background: var(--accent);
		color: #fff;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.dropped .box {
		border-color: var(--faint);
		background: transparent;
		color: transparent;
	}

	.draft input:focus-visible + .box {
		outline: 2px solid var(--link);
		outline-offset: 2px;
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
		overflow-wrap: anywhere;
	}

	.front {
		font-size: 16px;
		font-weight: 500;
	}

	.back {
		color: var(--muted);
		font-size: 15px;
	}

	.dropped .text {
		opacity: 0.45;
	}
</style>
