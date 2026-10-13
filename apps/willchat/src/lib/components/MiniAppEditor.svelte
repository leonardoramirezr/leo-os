<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { t } from '$lib/i18n';
	import { miniApps, newId, questionsOf, type MiniApp, type MiniAppInput } from '$lib/miniapps.svelte';
	import { runs } from '$lib/runs.svelte';
	import { fitViewport } from '$lib/viewport';
	import Bar from './Bar.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		/** The mini app to edit; none for a new one. */
		app?: MiniApp;
		onsave: (id: string) => void;
		oncancel: () => void;
		ondelete: () => void;
	}

	let { app, onsave, oncancel, ondelete }: Props = $props();

	// A copy: nothing changes until it is saved.
	const original = untrack(() => app);
	let name = $state(original?.name ?? '');
	let prompt = $state(original?.prompt ?? '');
	let inputs = $state<MiniAppInput[]>(original?.inputs.map((input) => ({ ...input })) ?? []);

	let textarea: HTMLTextAreaElement;

	const questions = $derived(questionsOf(prompt));
	const canSave = $derived(prompt.trim() !== '');
	const dirty = $derived(
		name !== (app?.name ?? '') ||
			prompt !== (app?.prompt ?? '') ||
			JSON.stringify(inputs) !== JSON.stringify(app?.inputs ?? [])
	);

	function save(event?: SubmitEvent) {
		event?.preventDefault();
		if (!canSave) return;

		const draft = {
			name: name.trim() || t.untitled,
			prompt,
			inputs: $state.snapshot(inputs).map((input) => ({ ...input, title: input.title.trim() }))
		};
		if (app) {
			miniApps.update(app.id, draft);
			onsave(app.id);
		} else {
			onsave(miniApps.add(draft).id);
		}
	}

	function cancel() {
		if (!dirty || confirm(t.confirmDiscard)) oncancel();
	}

	function remove() {
		if (!app || !confirm(t.confirmDeleteMiniApp)) return;
		miniApps.remove(app.id);
		runs.forget(app.id);
		ondelete();
	}

	/** Puts an empty question where the cursor is, with the cursor inside it, ready to be typed. */
	async function insertQuestion() {
		const start = textarea.selectionStart ?? prompt.length;
		const end = textarea.selectionEnd ?? start;
		const before = prompt.slice(0, start);
		const opening = before && !before.endsWith('\n') ? '\n[[[' : '[[[';
		prompt = `${before}${opening}]]]${prompt.slice(end)}`;

		await tick();
		const cursor = before.length + opening.length;
		textarea.focus();
		textarea.setSelectionRange(cursor, cursor);
	}

	function addInput(kind: MiniAppInput['kind']) {
		inputs.push({ id: newId(), kind, title: '' });
	}
</script>

<div class="screen" {@attach fitViewport}>
	<Bar>
		{#snippet start()}
			<button class="text-button" onclick={cancel}>{t.cancel}</button>
		{/snippet}

		<h1>{app ? t.editMiniApp : t.newMiniApp}</h1>

		{#snippet end()}
			<button class="text-button strong" onclick={() => save()} disabled={!canSave}>{t.save}</button>
		{/snippet}
	</Bar>

	<main class="scroller">
		<form class="content" onsubmit={save}>
			<label class="field">
				<span class="label">{t.name}</span>
				<input bind:value={name} placeholder={t.untitled} autocomplete="off" />
			</label>

			<div class="field">
				<div class="label-row">
					<label class="label" for="mini-app-prompt">{t.prompt}</label>
					<button type="button" class="link" onclick={insertQuestion}>
						<Icon name="plus" size={16} />
						{t.addQuestion}
					</button>
				</div>
				<textarea
					id="mini-app-prompt"
					bind:this={textarea}
					bind:value={prompt}
					rows="10"
					placeholder={t.promptPlaceholder}
					spellcheck="false"
				></textarea>
				<p class="hint">{t.promptHint}</p>
			</div>

			<section>
				<h2>{t.questions}</h2>
				{#if questions.length}
					<ul class="questions">
						{#each questions as question (question)}
							<li>{question}</li>
						{/each}
					</ul>
				{:else}
					<p class="hint">{t.noQuestions}</p>
				{/if}
			</section>

			<section>
				<h2>{t.filesAndImages}</h2>
				<p class="hint">{t.filesHint}</p>

				{#each inputs as input, index (input.id)}
					<div class="input">
						<select bind:value={input.kind} aria-label={t.filesAndImages}>
							<option value="image">{t.imageField}</option>
							<option value="file">{t.fileField}</option>
						</select>
						<input bind:value={input.title} placeholder={t.fieldTitle} aria-label={t.fieldTitle} />
						<button
							type="button"
							class="icon-button"
							onclick={() => inputs.splice(index, 1)}
							aria-label={t.removeField}
							title={t.removeField}
						>
							<Icon name="close" size={18} />
						</button>
					</div>
				{/each}

				<div class="add">
					<button type="button" onclick={() => addInput('image')}>
						<Icon name="image" size={18} />
						{t.imageField}
					</button>
					<button type="button" onclick={() => addInput('file')}>
						<Icon name="file" size={18} />
						{t.fileField}
					</button>
				</div>
			</section>

			{#if app}
				<button type="button" class="delete" onclick={remove}>
					<Icon name="trash" size={18} />
					{t.deleteMiniApp}
				</button>
			{/if}
		</form>
	</main>
</div>

<style>
	h1 {
		margin: 0;
		overflow: hidden;
		font-size: 17px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 768px;
		margin: 0 auto;
		padding: 12px max(16px, env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom))
			max(16px, env(safe-area-inset-left));
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.label,
	h2 {
		margin: 0;
		color: var(--muted);
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 15px;
	}

	input,
	textarea,
	select {
		width: 100%;
		margin: 0;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 14px;
		outline: none;
		background: var(--surface);
		font-size: 16px;
	}

	input:focus,
	textarea:focus,
	select:focus {
		border-color: var(--muted);
	}

	textarea {
		min-height: 200px;
		font-family: var(--mono);
		font-size: 15px;
		line-height: 1.5;
		resize: vertical;
		field-sizing: content;
	}

	input::placeholder,
	textarea::placeholder {
		color: var(--muted);
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.45;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.questions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.questions li {
		padding: 5px 12px;
		border-radius: 999px;
		background: var(--bubble);
		font-size: 15px;
		overflow-wrap: anywhere;
	}

	.input {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.input select {
		flex: none;
		width: auto;
		padding-right: 10px;
	}

	.input input {
		flex: 1;
		min-width: 0;
	}

	.add {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.add button,
	.delete {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		font-size: 15px;
	}

	.delete {
		align-self: flex-start;
		border-color: color-mix(in srgb, var(--danger) 35%, transparent);
		color: var(--danger);
	}
</style>
