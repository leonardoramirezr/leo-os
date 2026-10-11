<script lang="ts">
	import { HomeButton } from '@leo-os/shared';
	import { parse, questions, render } from '$lib/template';
	import { templates, titleOf, type Template } from '$lib/templates.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';
	import TemplateSheet from './TemplateSheet.svelte';

	let { template }: { template: Template } = $props();

	let editing = $state(false);
	let previewing = $state(false);
	let copied = $state(false);
	let notice = $state('');
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	const title = $derived(titleOf(template));
	const asked = $derived(questions(template.body));
	const answers = $derived(templates.answersTo(template.id));
	const parts = $derived(parse(template.body));
	const prompt = $derived(render(template.body, answers));
	const missing = $derived(asked.filter((question) => !answers[question]?.trim()).length);
	const answered = $derived(asked.length - missing);

	async function copy() {
		try {
			await navigator.clipboard.writeText(prompt);
			notice = '';
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 1500);
		} catch {
			// Not allowed, or not offered: the preview's text can still be selected and copied by hand.
			notice = 'No se pudo copiar. Toca Ver prompt y cópialo a mano.';
		}
	}

	/** Goes up with every «Borrar», so the answer boxes are drawn anew, empty. */
	let cleared = $state(0);

	function clear() {
		// iOS keeps the word being typed in its own hands until the box loses the focus, and then hands
		// it over as typed: emptied with the box still focused, the answer came back. Out of focus
		// first, the word is in before anything is emptied.
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
		if (answered && !confirm('¿Borrar todas las respuestas?')) return;
		templates.clearAnswers(template.id);
		cleared++;
	}

	/** What a box says, unless it is one that «Borrar» has already taken off the screen. */
	function oninput(question: string, event: Event & { currentTarget: HTMLTextAreaElement }) {
		if (event.currentTarget.isConnected) templates.answer(template.id, question, event.currentTarget.value);
	}
</script>

<div class="screen">
	<header>
		<div class="side">
			<button
				class="icon-button"
				type="button"
				onclick={() => history.back()}
				aria-label="Plantillas"
				title="Plantillas"
			>
				<Icon name="back" size={26} />
			</button>
		</div>

		<h1>{title}</h1>

		<div class="side end">
			<button
				class="icon-button"
				type="button"
				onclick={() => (editing = true)}
				aria-label="Editar plantilla"
				title="Editar plantilla"
				aria-haspopup="dialog"
			>
				<Icon name="edit" />
			</button>
			<HomeButton />
		</div>
	</header>

	<main>
		{#if asked.length}
			<div class="heading">
				<h2 class="section-title">
					{asked.length === 1 ? 'Responde la pregunta' : `Responde las ${asked.length} preguntas`}
				</h2>
				{#if answered}
					<button class="text-button" type="button" onclick={clear}>Borrar</button>
				{/if}
			</div>

			<div class="group">
				{#each asked as question, index (`${cleared}:${question}`)}
					<label class="field">
						<span>{index + 1}. {question}</span>
						<textarea
							value={answers[question] ?? ''}
							oninput={(event) => oninput(question, event)}
							rows="1"
							placeholder="Tu respuesta"
							autocapitalize="sentences"
						></textarea>
					</label>
				{/each}
			</div>
		{:else}
			<p class="none">
				Esta plantilla no tiene preguntas: el prompt es su texto tal cual. Edítala y pon entre tres
				corchetes, <code>[[[así]]]</code>, lo que quieras responder cada vez.
			</p>
		{/if}
	</main>

	<footer>
		<p class="status" role="status">
			{#if notice}
				{notice}
			{:else if missing}
				{missing === 1 ? 'Falta 1 respuesta' : `Faltan ${missing} respuestas`}: queda vacío en el prompt.
			{/if}
		</p>
		<div class="actions">
			<button class="secondary" type="button" onclick={() => (previewing = true)} aria-haspopup="dialog">
				<Icon name="eye" />
				Ver prompt
			</button>
			<button class="primary" type="button" onclick={copy}>
				<Icon name={copied ? 'check' : 'copy'} />
				{copied ? 'Copiado' : 'Copiar'}
			</button>
		</div>
	</footer>
</div>

<Sheet bind:open={previewing} title="Prompt">
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (previewing = false)}>Cerrar</button>
	{/snippet}
	{#snippet trailing()}
		<button class="text-button strong" type="button" onclick={copy}>{copied ? 'Copiado' : 'Copiar'}</button>
	{/snippet}

	<!-- Exactly what «Copiar» copies, with the answers marked, and a mark where one is missing. -->
	<div class="prompt">
		{#each parts as part, index (index)}
			{#if 'question' in part}
				{#if answers[part.question]?.trim()}
					<mark class="answer">{answers[part.question].trim()}</mark>
				{:else}
					<mark class="missing" title={part.question}>{part.question}</mark>
				{/if}
			{:else}
				{part.text}
			{/if}
		{/each}
	</div>
	{#if missing}
		<p class="hint">
			Lo marcado en amarillo aún no tiene respuesta, y al copiar el prompt queda vacío.
		</p>
	{/if}
</Sheet>

<TemplateSheet bind:open={editing} {template} />

<style>
	.screen {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(env(safe-area-inset-top) + 6px) max(10px, env(safe-area-inset-right)) 6px
			max(10px, env(safe-area-inset-left));
		background: var(--bg);
	}

	/* Both sides grow alike, so the title stays centred until it is too long for that. */
	.side {
		display: flex;
		flex: 1 1 0;
		align-items: center;
		gap: 2px;
		min-width: max-content;
	}

	.side.end {
		justify-content: flex-end;
	}

	h1 {
		flex: 0 1 auto;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		font-size: 17px;
		font-weight: 600;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	main {
		flex: 1;
		width: 100%;
		max-width: 560px;
		margin: 0 auto;
		padding: 0 16px 24px;
	}

	.heading {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.heading .section-title {
		margin-top: 12px;
	}

	.heading .text-button {
		margin-right: 16px;
		font-size: 15px;
	}

	/* The answers: one line to start with, growing with what is typed. */
	.field textarea {
		min-height: calc(1.35em);
	}

	.field > span {
		color: var(--text);
		font-size: 15px;
		font-weight: 600;
		line-height: 1.35;
	}

	.field textarea::placeholder {
		color: var(--faint);
	}

	.none {
		margin: 24px 8px;
		color: var(--muted);
		line-height: 1.5;
		text-align: center;
	}

	code {
		font-family: var(--mono);
		font-size: 14px;
		color: var(--tint);
	}

	/* The buttons stay at hand however long the questions run. */
	footer {
		position: sticky;
		bottom: 0;
		width: 100%;
		max-width: 560px;
		margin: 0 auto;
		padding: 0 16px calc(12px + env(safe-area-inset-bottom));
		background: linear-gradient(transparent, var(--bg) 16px);
	}

	.status {
		min-height: 1.4em;
		margin: 0 4px 8px;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.4;
		text-align: center;
	}

	.actions {
		display: flex;
		gap: 10px;
	}

	.actions button {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.secondary {
		padding: 14px;
		border: 0;
		border-radius: 14px;
		background: var(--group);
		box-shadow: var(--shadow);
		color: var(--tint);
		font-size: 17px;
		font-weight: 600;
		transition: transform 0.1s;
	}

	.secondary:active {
		transform: scale(0.98);
	}

	.prompt {
		padding: 16px;
		border-radius: 14px;
		background: var(--group);
		font-size: 16px;
		line-height: 1.55;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		user-select: text;
		-webkit-user-select: text;
	}

	mark {
		padding: 1px 3px;
		border-radius: 5px;
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}

	.answer {
		background: var(--blank-bg);
		color: var(--blank);
	}

	.missing {
		background: var(--missing-bg);
		color: var(--missing);
		font-style: italic;
	}
</style>
