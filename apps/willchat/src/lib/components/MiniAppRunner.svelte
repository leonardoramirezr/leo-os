<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { FileTooLargeError, readPicked } from '$lib/files';
	import { t } from '$lib/i18n';
	import { questionsOf, type MiniApp, type MiniAppInput } from '$lib/miniapps.svelte';
	import { uid } from '$lib/responses';
	import { runs } from '$lib/runs.svelte';
	import { fitViewport } from '$lib/viewport';
	import Bar from './Bar.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import Icon from './Icon.svelte';
	import ImageViewer from './ImageViewer.svelte';

	interface Props {
		app: MiniApp;
		onback: () => void;
		onedit: () => void;
		onchangekey: () => void;
	}

	let { app, onback, onedit, onchangekey }: Props = $props();

	// The page draws one per mini app, keyed by it.
	untrack(() => runs.open(app.id));

	let fileInput: HTMLInputElement;
	let resultSection = $state<HTMLElement>();
	/** The field the file picker was opened for. */
	let picking: MiniAppInput | undefined;

	let viewing = $state<string | null>(null);
	let problem = $state('');
	let copied = $state(false);
	let problemTimer: ReturnType<typeof setTimeout> | undefined;

	const run = $derived(runs.get(app.id));
	const questions = $derived(questionsOf(app.prompt));
	const pending = $derived(run?.result?.status === 'pending');
	const reading = $derived(
		!!run && Object.values(run.files).some((files) => files.some((file) => file.reading))
	);
	const touched = $derived(
		!!run &&
			(!!run.result ||
				Object.values(run.answers).some((answer) => answer.trim()) ||
				Object.values(run.files).some((files) => files.length > 0))
	);

	function labelOf(input: MiniAppInput) {
		return input.title || (input.kind === 'image' ? t.imageField : t.fileField);
	}

	async function send(event: SubmitEvent) {
		event.preventDefault();
		if (!run || pending || reading) return;

		if (isTouch()) (document.activeElement as HTMLElement | null)?.blur();
		const sending = runs.send(app);
		await tick();
		resultSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		await sending;
	}

	function pick(input: MiniAppInput) {
		picking = input;
		fileInput.accept = input.kind === 'image' ? 'image/*' : '';
		fileInput.click();
	}

	async function onchange() {
		const files = [...(fileInput.files ?? [])];
		fileInput.value = '';
		const input = picking;
		if (!run || !input || !files.length) return;

		const ids = files.map(() => uid());
		const added = files.map((file, index) => ({
			id: ids[index],
			name: file.name,
			type: file.type,
			url: '',
			reading: true
		}));
		// Assigned rather than pushed onto the array `??=` hands back, which is not the reactive one.
		run.files[input.id] = [...(run.files[input.id] ?? []), ...added];

		// One at a time: full-size photos use a lot of memory while decoding.
		for (const [index, file] of files.entries()) {
			try {
				const read = await readPicked(file);
				const entry = run.files[input.id]?.find(({ id }) => id === ids[index]);
				if (entry) Object.assign(entry, read, { reading: false });
			} catch (error) {
				removeFile(input, ids[index]);
				showProblem(error instanceof FileTooLargeError ? t.fileTooLarge : t.unreadableFile);
			}
		}
		runs.changed(app.id);
	}

	function removeFile(input: MiniAppInput, id: string) {
		if (!run) return;
		run.files[input.id] = (run.files[input.id] ?? []).filter((file) => file.id !== id);
		runs.changed(app.id);
	}

	function showProblem(message: string) {
		problem = message;
		clearTimeout(problemTimer);
		problemTimer = setTimeout(() => (problem = ''), 4000);
	}

	async function copy() {
		if (!run?.result?.text) return;
		try {
			await navigator.clipboard.writeText(run.result.text);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard, e.g. outside HTTPS: the text can still be selected by hand.
		}
	}

	function startOver() {
		if (confirm(t.confirmStartOver)) runs.clear(app.id);
	}

	function isTouch() {
		return matchMedia('(pointer: coarse)').matches;
	}
</script>

<div class="screen" {@attach fitViewport}>
	<Bar>
		{#snippet start()}
			<button class="icon-button" onclick={onback} aria-label={t.back} title={t.back}>
				<Icon name="back" />
			</button>
		{/snippet}

		<h1>{app.name}</h1>

		{#snippet end()}
			<button class="icon-button" onclick={onedit} aria-label={t.edit} title={t.edit}>
				<Icon name="edit" />
			</button>
		{/snippet}
	</Bar>

	<main class="scroller">
		{#if run}
			<div class="content">
				<form onsubmit={send}>
					{#each questions as question (question)}
						<label class="field">
							<span class="label">{question}</span>
							<textarea
								bind:value={run.answers[question]}
								oninput={() => runs.changed(app.id)}
								rows="2"
								placeholder={t.answerPlaceholder}
							></textarea>
						</label>
					{/each}

					{#each app.inputs as input (input.id)}
						<div class="field">
							<span class="label">{labelOf(input)}</span>
							<div class="files">
								{#each run.files[input.id] ?? [] as file (file.id)}
									<div class="file" class:image={file.type.startsWith('image/')}>
										{#if file.reading}
											<span class="spinner"></span>
										{:else if file.type.startsWith('image/')}
											<button type="button" class="thumb" onclick={() => (viewing = file.url)}>
												<img src={file.url} alt={file.name} />
											</button>
										{:else}
											<Icon name="file" size={18} />
											<span class="file-name">{file.name}</span>
										{/if}
										<button
											type="button"
											class="remove"
											onclick={() => removeFile(input, file.id)}
											aria-label={t.removeFile}
											title={t.removeFile}
										>
											<Icon name="close" size={12} />
										</button>
									</div>
								{/each}
								<button type="button" class="add" onclick={() => pick(input)}>
									<Icon name={input.kind === 'image' ? 'image' : 'file'} size={18} />
									{input.kind === 'image' ? t.addImages : t.addFiles}
								</button>
							</div>
						</div>
					{/each}

					{#if !questions.length && !app.inputs.length}
						<p class="hint">{t.noQuestions}</p>
					{/if}

					{#if problem}
						<p class="problem" role="alert">{problem}</p>
					{/if}

					<div class="actions">
						{#if pending}
							<button type="button" class="primary" onclick={() => runs.stop(app.id)}>
								<Icon name="stop" />
								{t.stop}
							</button>
						{:else}
							<button type="submit" class="primary" disabled={reading}>
								<Icon name="send" />
								{t.send}
							</button>
						{/if}
						<button type="button" class="secondary" onclick={startOver} disabled={!touched}>
							{t.startOver}
						</button>
					</div>
				</form>

				{#if run.result}
					<section class="result" bind:this={resultSection}>
						<h2>{t.result}</h2>
						<ChatMessage
							message={run.result}
							last
							onview={(src) => (viewing = src)}
							{onchangekey}
							onretry={() => runs.retry(app)}
						/>
						{#if run.result.status === 'done' && run.result.text}
							<button class="copy" onclick={copy}>
								<Icon name={copied ? 'check' : 'copy'} size={18} />
								{copied ? t.copied : t.copy}
							</button>
						{/if}
					</section>
				{/if}
			</div>
		{/if}
	</main>

	<input bind:this={fileInput} type="file" multiple hidden {onchange} />
</div>

{#if viewing}
	<ImageViewer src={viewing} onclose={() => (viewing = null)} />
{/if}

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
		gap: 32px;
		max-width: 768px;
		margin: 0 auto;
		padding: 12px max(16px, env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom))
			max(16px, env(safe-area-inset-left));
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.label {
		font-weight: 600;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	h2 {
		margin: 0;
		color: var(--muted);
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	textarea {
		width: 100%;
		min-height: 52px;
		max-height: 50dvh;
		margin: 0;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 14px;
		outline: none;
		background: var(--surface);
		font-size: 16px;
		line-height: 1.5;
		resize: vertical;
		field-sizing: content;
	}

	textarea:focus {
		border-color: var(--muted);
	}

	textarea::placeholder {
		color: var(--muted);
	}

	.files {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.file {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		max-width: 100%;
		height: 64px;
		padding: 0 34px 0 12px;
		border-radius: 14px;
		background: var(--subtle);
	}

	.file.image {
		justify-content: center;
		width: 64px;
		padding: 0;
	}

	.thumb {
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		border-radius: inherit;
		background: none;
	}

	.thumb img {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: inherit;
		object-fit: cover;
	}

	.file-name {
		overflow: hidden;
		font-size: 14px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.remove {
		position: absolute;
		top: 4px;
		right: 4px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: rgb(0 0 0 / 0.65);
		color: #fff;
	}

	.add {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 64px;
		padding: 0 16px;
		border: 1px dashed var(--border);
		border-radius: 14px;
		background: transparent;
		color: var(--muted);
		font-size: 15px;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid var(--border);
		border-top-color: var(--text);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: 15px;
	}

	.problem {
		margin: 0;
		color: var(--danger);
		font-size: 14px;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.primary,
	.secondary,
	.copy {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 44px;
		padding: 0 20px;
		border-radius: 999px;
		font-size: 16px;
		font-weight: 500;
	}

	.primary {
		flex: 1;
		border: 0;
		background: var(--accent);
		color: var(--accent-text);
	}

	.primary:disabled {
		opacity: 0.4;
	}

	.secondary,
	.copy {
		border: 1px solid var(--border);
		background: var(--surface);
	}

	.secondary:disabled {
		opacity: 0.4;
	}

	.result {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 24px;
		border-top: 1px solid var(--border);
		scroll-margin-top: 12px;
	}

	.copy {
		align-self: flex-start;
		height: 36px;
		padding: 0 14px;
		color: var(--muted);
		font-size: 14px;
	}
</style>
