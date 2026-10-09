<script lang="ts">
	// A routine pasted as JSON. The schema is on screen, with what each key is for, to copy into a
	// chat with an AI together with the routine as it is written elsewhere. What comes back is read,
	// each exercise is matched to the catalog by a model on Groq, and nothing is saved until the
	// matches have been looked over.
	import { pushState, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { HomeButton } from '@leo-os/shared';
	import { exerciseOf, normalize } from '$lib/catalog';
	import { describe } from '$lib/groq';
	import { daysFrom, guess, matchWithGroq, namesIn, readDraft, SCHEMA_TEXT, type Draft } from '$lib/importer';
	import { plural } from '$lib/format';
	import { routines } from '$lib/routines.svelte';
	import { apiKey, model } from '$lib/settings.svelte';
	import ExerciseMedia from './ExerciseMedia.svelte';
	import ExercisePicker from './ExercisePicker.svelte';
	import GroqKeyField from './GroqKeyField.svelte';
	import Icon from './Icon.svelte';

	let step = $state<'paste' | 'key' | 'matching' | 'review'>('paste');
	let text = $state('');
	let errors = $state<string[]>([]);
	let copied = $state(false);
	let draft: Draft | undefined;
	let name = $state('');
	let names = $state<string[]>([]);
	/** For each name, the catalog's id it is; '' for an exercise of the user's own. */
	let matches = $state<string[]>([]);
	let notice = $state('');
	let changing = 0;
	let pickerOpen = $state(false);

	const counts = $derived.by(() => {
		if (step !== 'review' || !draft) return '';
		const exercises = draft.days.reduce((sum, day) => sum + day.exercises.length, 0);
		return `${plural(draft.days.length, 'día', 'días')}, ${plural(exercises, 'ejercicio', 'ejercicios')}`;
	});

	function back() {
		if (step === 'review' || step === 'key') {
			step = 'paste';
			return;
		}
		replaceState('', { edit: page.state.edit });
	}

	async function copySchema() {
		try {
			await navigator.clipboard.writeText(SCHEMA_TEXT);
		} catch {
			// No clipboard API, or no permission: the old way, through a selection.
			const area = document.createElement('textarea');
			area.value = SCHEMA_TEXT;
			area.style.position = 'fixed';
			area.style.opacity = '0';
			document.body.append(area);
			area.select();
			document.execCommand('copy');
			area.remove();
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	async function paste() {
		try {
			text = await navigator.clipboard.readText();
		} catch {
			errors = ['No se pudo leer lo copiado. Mantén presionado el recuadro y elige «Pegar».'];
		}
	}

	function check() {
		const read = readDraft(text);
		errors = read.errors;
		if (!read.draft) return;

		draft = read.draft;
		name = read.draft.name;
		names = namesIn(read.draft);
		notice = '';
		if (apiKey.value) match();
		else step = 'key';
	}

	async function match() {
		step = 'matching';
		try {
			matches = await matchWithGroq(apiKey.value, model.value, names);
		} catch (error) {
			matches = names.map(guess);
			notice = `${describe(error)} Se emparejaron por nombre: revísalos.`;
		}
		step = 'review';
	}

	function withoutAi() {
		matches = names.map(guess);
		notice = 'Se emparejaron solo por nombre: revisa los que no encontró.';
		step = 'review';
	}

	function change(index: number) {
		changing = index;
		pickerOpen = true;
	}

	function picked(id: string) {
		matches[changing] = id;
	}

	function save() {
		if (!draft || !name.trim()) return;
		const byName = new Map(names.map((exerciseName, index) => [normalize(exerciseName), matches[index]]));
		const created = routines.add(name, daysFrom(draft, byName));
		// The list underneath, the new routine on top: «back» from it goes to the list.
		replaceState('', {});
		pushState('', { routine: created.id });
	}
</script>

<div class="screen">
	<header class="bar">
		<button class="back" type="button" onclick={back}>
			<Icon name="back" size={24} />
			<span>{step === 'paste' ? 'Volver' : 'JSON'}</span>
		</button>
		<h1 class="bar-title">Importar rutina</h1>
		<div class="spacer">
			<HomeButton />
		</div>
	</header>

	{#if step === 'paste'}
		<p class="lead">
			Pega tu rutina como JSON. Si la tienes en otro lado, copia este esquema y pásaselo a un chat de IA
			junto con tu rutina: te devolverá el JSON listo para pegar aquí.
		</p>

		<section class="schema">
			<div class="schema-head">
				<h2>Esquema JSON</h2>
				<button class="copy" type="button" onclick={copySchema}>
					<Icon name={copied ? 'check' : 'copy'} size={16} />
					{copied ? 'Copiado' : 'Copiar'}
				</button>
			</div>
			<pre>{SCHEMA_TEXT}</pre>
		</section>

		<div class="paste-head">
			<h2 class="section-title">Tu rutina</h2>
			{#if !text}
				<button class="text-button" type="button" onclick={paste}>Pegar</button>
			{/if}
		</div>
		<textarea
			bind:value={text}
			placeholder={'{\n  "name": "Full body 5 días",\n  "days": [ … ]\n}'}
			spellcheck="false"
			autocapitalize="off"
			autocomplete="off"
			aria-label="JSON de la rutina"
		></textarea>

		{#if errors.length}
			<ul class="errors" role="alert">
				{#each errors as error (error)}
					<li>{error}</li>
				{/each}
			</ul>
		{/if}

		<button class="primary go" type="button" onclick={check} disabled={!text.trim()}>Revisar</button>
	{:else if step === 'key'}
		<p class="lead">
			Para saber a qué ejercicio de la app corresponde cada uno de tu rutina se usa un modelo de Groq, con
			tu propia API key.
		</p>
		<GroqKeyField onsaved={match} />
		<button class="secondary without" type="button" onclick={withoutAi}>Continuar sin IA</button>
	{:else if step === 'matching'}
		<div class="matching" aria-busy="true">
			<span class="spinner"></span>
			<p>Buscando tus {plural(names.length, 'ejercicio', 'ejercicios')} en la base de la app…</p>
		</div>
	{:else}
		<div class="group">
			<label class="field">
				<span>Nombre de la rutina</span>
				<input type="text" bind:value={name} autocomplete="off" />
			</label>
		</div>
		<p class="hint">{counts}</p>

		{#if notice}
			<p class="notice">{notice}</p>
		{/if}

		<h2 class="section-title">Ejercicios</h2>
		<ul class="group">
			{#each names as exerciseName, index (exerciseName)}
				{@const found = exerciseOf(matches[index] ?? '')}
				<li>
					<button class="match" type="button" onclick={() => change(index)} aria-haspopup="dialog">
						<ExerciseMedia exercise={found?.id} thumb />
						<span class="text">
							<span class="given">{exerciseName}</span>
							{#if found}
								<span class="found">
									<span class="dot" style:background="var(--group-{found.group})"></span>
									{found.name}
								</span>
							{:else}
								<span class="found none">Sin coincidencia: ejercicio propio, sin animación</span>
							{/if}
						</span>
						<span class="change">Cambiar</span>
					</button>
				</li>
			{/each}
		</ul>
		<p class="hint">
			Cada ejercicio conserva el nombre de tu JSON; la coincidencia da su animación. Toca uno para elegir
			otro.
		</p>

		<button class="primary go" type="button" onclick={save} disabled={!name.trim()}>Guardar rutina</button>
	{/if}
</div>

<ExercisePicker bind:open={pickerOpen} title="Elegir ejercicio" onpick={(id) => picked(id)} />

<style>
	/* As wide as the way back, so the title stays centred. */
	.spacer {
		display: flex;
		justify-content: flex-end;
		width: 64px;
	}

	.lead {
		margin: 8px 4px 16px;
		color: var(--muted);
		line-height: 1.5;
	}

	.schema {
		overflow: hidden;
		border-radius: 14px;
		background: var(--group);
	}

	.schema-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px 10px 16px;
		border-bottom: 1px solid var(--border);
	}

	.schema-head h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.copy {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 0;
		border-radius: 999px;
		background: var(--hover);
		color: var(--tint);
		font-size: 15px;
		font-weight: 600;
	}

	pre {
		max-height: 42dvh;
		margin: 0;
		padding: 12px 16px;
		overflow: auto;
		font-family: var(--mono);
		font-size: 12px;
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		-webkit-overflow-scrolling: touch;
	}

	.paste-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.paste-head .section-title {
		margin-bottom: 4px;
	}

	textarea {
		display: block;
		width: 100%;
		min-height: 180px;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 14px;
		outline: none;
		background: var(--group);
		font-family: var(--mono);
		font-size: 13px;
		line-height: 1.45;
		resize: vertical;
	}

	textarea:focus {
		border-color: var(--accent);
	}

	.errors {
		margin: 12px 0 0;
		padding: 0 0 0 20px;
		color: var(--danger);
		font-size: 14px;
		line-height: 1.45;
	}

	.go {
		margin-top: 20px;
	}

	.without {
		margin-top: 12px;
	}

	.matching {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 64px 16px;
		color: var(--muted);
		text-align: center;
	}

	.notice {
		margin: 12px 0 0;
		padding: 10px 14px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--alarm) 12%, transparent);
		font-size: 14px;
		line-height: 1.4;
	}

	li + li {
		border-top: 1px solid var(--border);
	}

	.match {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 66px;
		padding: 8px 16px 8px 8px;
		border: 0;
		background: none;
		text-align: left;
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
	}

	.given {
		font-size: 15px;
		font-weight: 500;
		line-height: 1.3;
	}

	.found {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--muted);
		font-size: 13px;
	}

	.found.none {
		color: var(--danger);
	}

	.change {
		flex: none;
		color: var(--link);
		font-size: 15px;
	}
</style>
