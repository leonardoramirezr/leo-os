<script lang="ts">
	import { tick } from 'svelte';
	import { chat } from '$lib/chat.svelte';
	import { Dictation } from '$lib/dictation.svelte';
	import { t } from '$lib/i18n';
	import { prepareImage } from '$lib/images';
	import { groqKey } from '$lib/settings.svelte';
	import Icon from './Icon.svelte';

	let { onsend, onneedgroqkey }: { onsend: () => void; onneedgroqkey: () => void } = $props();

	interface Attachment {
		id: number;
		/** Set once the photo has been resized. */
		url?: string;
	}

	let text = $state('');
	let attachments = $state<Attachment[]>([]);
	let problem = $state('');

	let textarea: HTMLTextAreaElement;
	let fileInput: HTMLInputElement;
	let nextId = 0;
	let problemTimer: ReturnType<typeof setTimeout> | undefined;

	const dictation = new Dictation({ onheard: insert, onproblem: showProblem });
	/** The box shows the microphone instead of the text: it is listening, or writing down what it heard. */
	const dictating = $derived(dictation.phase === 'recording' || dictation.phase === 'transcribing');
	const clock = $derived(
		`${Math.floor(dictation.seconds / 60)}:${String(dictation.seconds % 60).padStart(2, '0')}`
	);

	const ready = $derived(attachments.every((attachment) => attachment.url));
	const canSend = $derived(
		chat.loaded &&
			!chat.pending &&
			ready &&
			dictation.phase === 'idle' &&
			(text.trim() !== '' || attachments.length > 0)
	);

	$effect(() => {
		const onhide = () => {
			if (document.visibilityState === 'hidden') dictation.interrupt();
		};
		document.addEventListener('visibilitychange', onhide);
		return () => {
			document.removeEventListener('visibilitychange', onhide);
			// Leaving the chat, to change the API key for instance, closes the microphone.
			dictation.cancel();
		};
	});

	function dictate() {
		// With no Groq key there is nothing to transcribe with: the settings are where it goes.
		if (dictation.phase === 'idle' && !groqKey.value) onneedgroqkey();
		else dictation.toggle();
	}

	/** Puts what was dictated after whatever was already written, to be read over before sending. */
	function insert(heard: string) {
		text = !text || /\s$/.test(text) ? text + heard : `${text} ${heard}`;
		tick().then(() => {
			resize();
			// On a computer the cursor waits after it, to go on typing or send with Enter. A touch
			// keyboard is left down: it would cover what was just dictated.
			if (!isTouch()) textarea.focus();
		});
	}

	async function addPhotos(files: File[]) {
		const ids = files.map(() => nextId++);
		attachments.push(...ids.map((id) => ({ id })));

		// One at a time: full-size photos use a lot of memory while decoding.
		for (const [index, file] of files.entries()) {
			try {
				const url = await prepareImage(file);
				const attachment = attachments.find(({ id }) => id === ids[index]);
				if (attachment) attachment.url = url;
			} catch {
				remove(ids[index]);
				showProblem(t.unreadablePhoto);
			}
		}
	}

	function remove(id: number) {
		attachments = attachments.filter((attachment) => attachment.id !== id);
	}

	function showProblem(message: string) {
		problem = message;
		clearTimeout(problemTimer);
		problemTimer = setTimeout(() => (problem = ''), 4000);
	}

	function onchange() {
		const files = [...(fileInput.files ?? [])];
		fileInput.value = '';
		if (files.length) addPhotos(files);
	}

	function onpaste(event: ClipboardEvent) {
		const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'));
		if (!files.length) return;
		event.preventDefault();
		addPhotos(files);
	}

	function onkeydown(event: KeyboardEvent) {
		// Enter sends on computers; on touch keyboards it inserts a new line.
		if (event.key !== 'Enter' || event.shiftKey || event.isComposing || isTouch()) return;
		event.preventDefault();
		submit();
	}

	function submit(event?: SubmitEvent) {
		event?.preventDefault();
		if (!canSend) return;

		chat.send(
			text.trim(),
			attachments.map((attachment) => attachment.url!)
		);
		text = '';
		attachments = [];
		tick().then(resize);
		if (isTouch()) textarea.blur();
		onsend();
	}

	function resize() {
		textarea.style.height = 'auto';
		textarea.style.height = `${textarea.scrollHeight}px`;
	}

	function isTouch() {
		return matchMedia('(pointer: coarse)').matches;
	}
</script>

<form onsubmit={submit}>
	{#if problem}
		<p class="problem" role="alert">{problem}</p>
	{/if}

	<div class="box">
		{#if attachments.length}
			<div class="attachments">
				{#each attachments as attachment (attachment.id)}
					<div class="attachment">
						{#if attachment.url}
							<img src={attachment.url} alt="" />
						{:else}
							<span class="spinner"></span>
						{/if}
						<button
							type="button"
							class="remove"
							onclick={() => remove(attachment.id)}
							aria-label={t.removePhoto}
						>
							<Icon name="close" size={12} />
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="row">
			{#if dictating}
				<button
					type="button"
					class="round"
					onclick={() => dictation.cancel()}
					aria-label={t.cancel}
					title={t.cancel}
				>
					<Icon name="close" />
				</button>
			{:else}
				<button
					type="button"
					class="round"
					onclick={() => fileInput.click()}
					aria-label={t.addPhotos}
					title={t.addPhotos}
				>
					<Icon name="plus" size={22} />
				</button>
			{/if}

			<!-- Hidden rather than removed while dictating: it stays bound, to be sized and focused as
			     soon as the transcription lands after what was already written. -->
			<textarea
				bind:this={textarea}
				bind:value={text}
				hidden={dictating}
				rows="1"
				placeholder={t.placeholder}
				oninput={resize}
				{onkeydown}
				{onpaste}
			></textarea>

			{#if dictation.phase === 'recording'}
				<div class="dictation">
					<span class="clock">{clock}</span>
					<span class="wave" aria-hidden="true">
						{#each dictation.levels as level, index (index)}
							<span style:--level={level}></span>
						{/each}
					</span>
				</div>
			{:else if dictation.phase === 'transcribing'}
				<div class="dictation">
					<span class="shimmer">{t.transcribing}</span>
				</div>
			{/if}

			<button
				type="button"
				class="round"
				class:finish={dictation.phase === 'recording'}
				disabled={dictation.phase === 'starting' || dictation.phase === 'transcribing'}
				aria-busy={dictation.phase === 'starting' || dictation.phase === 'transcribing'}
				onclick={dictate}
				aria-label={dictation.phase === 'recording' ? t.transcribe : t.dictate}
				title={dictation.phase === 'recording' ? t.transcribe : t.dictate}
			>
				{#if dictation.phase === 'starting' || dictation.phase === 'transcribing'}
					<span class="spinner"></span>
				{:else if dictation.phase === 'recording'}
					<Icon name="check" />
				{:else}
					<Icon name="mic" />
				{/if}
			</button>

			{#if chat.pending}
				<button type="button" class="round send" onclick={() => chat.stop()} aria-label={t.stop} title={t.stop}>
					<Icon name="stop" />
				</button>
			{:else}
				<button type="submit" class="round send" disabled={!canSend} aria-label={t.send} title={t.send}>
					<Icon name="send" />
				</button>
			{/if}
		</div>
	</div>

	<input bind:this={fileInput} type="file" accept="image/*" multiple hidden {onchange} />
</form>

<style>
	form {
		flex: none;
		width: 100%;
		max-width: 800px;
		margin: 0 auto;
		padding: 4px max(12px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom))
			max(12px, env(safe-area-inset-left));
	}

	.problem {
		margin: 0 0 8px;
		color: var(--danger);
		font-size: 14px;
		text-align: center;
	}

	.box {
		border: 1px solid var(--border);
		border-radius: 26px;
		background: var(--surface);
		box-shadow: var(--shadow);
	}

	.attachments {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 10px 10px 2px;
	}

	.attachment {
		position: relative;
		display: grid;
		flex: none;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 14px;
		background: var(--subtle);
	}

	.attachment img {
		width: 100%;
		height: 100%;
		border-radius: inherit;
		object-fit: cover;
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

	.row {
		display: flex;
		align-items: flex-end;
		gap: 4px;
		padding: 6px;
	}

	textarea {
		flex: 1;
		min-width: 0;
		max-height: 35dvh;
		margin: 0;
		padding: 8px 4px;
		border: 0;
		outline: none;
		background: transparent;
		font-size: 16px;
		line-height: 24px;
		resize: none;
	}

	textarea::placeholder {
		color: var(--muted);
	}

	.dictation {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 10px;
		min-width: 0;
		height: 40px;
		padding: 0 4px;
	}

	.clock {
		display: flex;
		flex: none;
		align-items: center;
		gap: 6px;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
	}

	.clock::before {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--live);
		content: '';
	}

	/* The newest bar on the right; the oldest ones run off the left edge. */
	.wave {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: flex-end;
		gap: 2px;
		min-width: 0;
		height: 24px;
		overflow: hidden;
	}

	/* Silence is a faint dotted line, and the voice stands out of it. */
	.wave span {
		flex: none;
		width: 3px;
		height: calc(3px + var(--level) * 21px);
		border-radius: 1.5px;
		background: var(--text);
		opacity: calc(0.25 + var(--level) * 1.5);
	}

	.shimmer {
		background: linear-gradient(90deg, var(--muted) 30%, var(--text) 50%, var(--muted) 70%);
		background-size: 200% 100%;
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		font-weight: 500;
		animation: shimmer 2s linear infinite;
	}

	.round {
		display: grid;
		flex: none;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--text);
	}

	.send,
	.finish {
		background: var(--accent);
		color: var(--accent-text);
	}

	.send:disabled {
		opacity: 0.25;
	}
</style>
