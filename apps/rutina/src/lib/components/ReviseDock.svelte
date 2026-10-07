<script lang="ts">
	// Changes to the routine the AI proposed, asked for in words: «cambia la sentadilla por prensa»,
	// «quita el viernes», «más descanso en todo». Two buttons float over the proposal: one opens a
	// window to write the change in, which can be tucked away to look at the routine underneath; the
	// other records it, and once the recording stops the same window opens with what was written down,
	// to be corrected before it goes. The model answers with the whole routine changed, which takes
	// the editor's place, with the way back one tap away.
	import { flushSync, onMount } from 'svelte';
	import { Dictation } from '$lib/dictation.svelte';
	import { formatClock } from '$lib/format';
	import { describe, GroqError } from '$lib/groq';
	import { apiKey, model } from '$lib/settings.svelte';
	import { reviseRoutine, type Written } from '$lib/writer';
	import GroqKeyField from './GroqKeyField.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		/** The routine as it is on screen right now, changes made by hand included. */
		current: () => Written;
		/** Puts a routine on screen: the changed one, or the one before it, to undo the change. */
		onrevised: (routine: Written) => void;
	}

	let { current, onrevised }: Props = $props();

	let pane = $state<'closed' | 'open' | 'minimized'>('closed');
	let text = $state('');
	let sending = $state(false);
	let error = $state('');
	let keyRefused = $state(false);
	/** The last change: what the model said of it, and the routine before it while it can be undone. */
	let done = $state.raw<{ summary: string; before?: Written }>();
	/** How much of the bottom of the screen the keyboard covers. */
	let keyboard = $state(0);
	let field = $state<HTMLTextAreaElement>();
	/** Goes up with every change asked for, and when the window is closed: an answer after that is dropped. */
	let attempt = 0;

	const dictation = new Dictation((heard) => {
		const before = text.trimEnd();
		text = before ? `${before}\n${heard}` : heard;
		pane = 'open';
	});

	const recording = $derived(dictation.phase === 'recording');
	const listening = $derived(dictation.phase !== 'idle');

	onMount(() => {
		// iOS lays the keyboard over the page instead of making the page shorter, and a window fixed to
		// the bottom would be left under it: it rides on top of the keyboard instead.
		const viewport = window.visualViewport;
		const place = () => {
			if (viewport) keyboard = Math.max(0, Math.round(innerHeight - viewport.height - viewport.offsetTop));
		};
		viewport?.addEventListener('resize', place);
		viewport?.addEventListener('scroll', place);

		const onhide = () => {
			if (document.visibilityState === 'hidden') dictation.interrupt();
		};
		document.addEventListener('visibilitychange', onhide);

		return () => {
			viewport?.removeEventListener('resize', place);
			viewport?.removeEventListener('scroll', place);
			document.removeEventListener('visibilitychange', onhide);
			dictation.dispose();
		};
	});

	/** Opens the window with the keyboard up: focused within the tap itself, or iOS keeps it down. */
	function write() {
		done = undefined;
		pane = 'open';
		flushSync();
		field?.focus();
	}

	function talk() {
		done = undefined;
		error = '';
		// Without a key there is nobody to write it down: the window asks for one.
		if (!apiKey.value) pane = 'open';
		else dictation.toggle();
	}

	/** Closes the window and drops what was in it, and the change on its way if there is one. */
	function close() {
		dictation.cancel();
		attempt++;
		sending = false;
		text = '';
		error = '';
		pane = 'closed';
	}

	async function send() {
		const request = text.trim();
		if (!request || sending || dictation.phase !== 'idle') return;

		const before = current();
		const mine = ++attempt;
		sending = true;
		error = '';
		keyRefused = false;
		try {
			const revision = await reviseRoutine(apiKey.value, model.value, before, request);
			if (mine !== attempt) return;
			if (revision.changed) onrevised(revision.routine);
			done = revision.changed
				? { summary: revision.summary || 'Listo: cambié la rutina.', before }
				: { summary: revision.summary || 'La rutina quedó igual.' };
			text = '';
			pane = 'closed';
		} catch (e) {
			if (mine !== attempt) return;
			error = describe(e);
			keyRefused = e instanceof GroqError && e.status === 401;
			// Tucked away, it would fail out of sight.
			pane = 'open';
		} finally {
			if (mine === attempt) sending = false;
		}
	}

	function undo() {
		if (done?.before) onrevised(done.before);
		done = undefined;
	}

	/** Drops the key Groq turned down, which brings back the field that asks for one. */
	function changeKey() {
		error = '';
		keyRefused = false;
		dictation.error = '';
		dictation.keyRefused = false;
		apiKey.value = '';
		pane = 'open';
	}
</script>

{#snippet failure(message: string, refused: boolean)}
	<p class="error" role="alert">
		{message}
		{#if refused}
			<button class="link" type="button" onclick={changeKey}>Cambiar API key</button>
		{/if}
	</p>
{/snippet}

{#snippet status()}
	{#if dictation.phase === 'starting'}
		Abriendo el micrófono…
	{:else if recording}
		<span class="live-dot"></span> Escuchando · <span class="clock">{formatClock(dictation.seconds)}</span>
	{:else if dictation.phase === 'transcribing'}
		Transcribiendo…
	{/if}
{/snippet}

{#snippet mic(size: number)}
	<button
		class="mic"
		class:live={recording}
		type="button"
		disabled={dictation.busy || sending}
		aria-busy={dictation.busy}
		aria-label={recording ? 'Detener y transcribir' : 'Pedir un cambio hablando'}
		title={recording ? 'Detener y transcribir' : 'Pedir un cambio hablando'}
		style:--size="{size}px"
		style:--level={dictation.level}
		onclick={talk}
	>
		<span class="halo" aria-hidden="true"></span>
		<span class="round">
			{#if dictation.busy}
				<span class="spinner" aria-hidden="true"></span>
			{:else if recording}
				<Icon name="stop" size={size > 50 ? 24 : 20} />
			{:else}
				<Icon name="mic" size={size > 50 ? 26 : 20} />
			{/if}
		</span>
	</button>
{/snippet}

<div class="dock" style:--keyboard="{keyboard}px">
	<div class="inner">
		{#if pane === 'open'}
			<section class="pane" aria-label="Cambiar la rutina">
				<header>
					<h2>Cambiar la rutina</h2>
					<button
						class="icon-button"
						type="button"
						onclick={() => (pane = 'minimized')}
						aria-label="Minimizar"
						title="Minimizar"
					>
						<Icon name="down" />
					</button>
					<button class="icon-button" type="button" onclick={close} aria-label="Cerrar" title="Cerrar">
						<Icon name="close" />
					</button>
				</header>

				{#if !apiKey.value}
					<GroqKeyField />
				{:else}
					<textarea
						bind:this={field}
						bind:value={text}
						disabled={sending}
						placeholder="«Cambia la sentadilla por prensa de piernas», «quita el viernes», «90 segundos de descanso en todo»…"
						aria-label="El cambio que quieres"
					></textarea>

					{#if dictation.error}
						{@render failure(dictation.error, dictation.keyRefused)}
					{/if}
					{#if error}
						{@render failure(error, keyRefused)}
					{/if}

					<div class="actions">
						{@render mic(44)}
						<p class="status" class:live={recording} role="status">
							{#if sending}
								Cambiando la rutina…
							{:else}
								{@render status()}
							{/if}
						</p>
						{#if recording}
							<button class="text-button" type="button" onclick={() => dictation.cancel()}>Cancelar</button>
						{:else}
							<button
								class="send"
								type="button"
								onclick={send}
								disabled={!text.trim() || sending || dictation.phase !== 'idle'}
							>
								{#if sending}
									<span class="spinner" aria-hidden="true"></span>
								{:else}
									<Icon name="send" size={18} />
								{/if}
								Enviar
							</button>
						{/if}
					</div>
				{/if}
			</section>
		{:else if pane === 'minimized'}
			<button class="tucked" type="button" onclick={() => (pane = 'open')} aria-label="Abrir «Cambiar la rutina»">
				<span class="tucked-icon">
					{#if sending}
						<span class="spinner" aria-hidden="true"></span>
					{:else}
						<Icon name="write" />
					{/if}
				</span>
				<span class="tucked-text">
					<span class="tucked-title">Cambiar la rutina</span>
					<span class="preview">{sending ? 'Cambiando la rutina…' : text.trim() || 'Sin escribir todavía'}</span>
				</span>
				<Icon name="up" />
			</button>
		{:else}
			{#if done}
				<div class="done" role="status">
					<p>{done.summary}</p>
					{#if done.before}
						<button class="text-button undo" type="button" onclick={undo}>
							<Icon name="undo" size={18} />
							Deshacer
						</button>
					{/if}
					<button class="icon-button" type="button" onclick={() => (done = undefined)} aria-label="Cerrar">
						<Icon name="close" size={18} />
					</button>
				</div>
			{/if}

			{#if dictation.error}
				<div class="note">{@render failure(dictation.error, dictation.keyRefused)}</div>
			{/if}

			<div class="buttons">
				{#if listening}
					<p class="listening" class:live={recording} role="status">
						{@render status()}
						{#if recording}
							<button class="text-button" type="button" onclick={() => dictation.cancel()}>Cancelar</button>
						{/if}
					</p>
				{/if}
				<button
					class="fab"
					type="button"
					onclick={write}
					disabled={listening}
					aria-label="Pedir un cambio por escrito"
					title="Pedir un cambio por escrito"
				>
					<Icon name="write" size={24} />
				</button>
				{@render mic(60)}
			</div>
		{/if}
	</div>
</div>

<style>
	.dock {
		position: fixed;
		right: 0;
		bottom: var(--keyboard);
		left: 0;
		z-index: 10;
		/* Only what is drawn in it takes taps: the page around the buttons stays usable. */
		pointer-events: none;
	}

	.inner {
		display: flex;
		max-width: 560px;
		flex-direction: column;
		align-items: flex-end;
		gap: 10px;
		margin: 0 auto;
		padding: 0 16px calc(16px + env(safe-area-inset-bottom));
	}

	.inner > * {
		pointer-events: auto;
	}

	.pane,
	.tucked,
	.done,
	.note,
	.listening {
		border: 1px solid var(--border);
		background: var(--group);
		box-shadow: 0 6px 28px light-dark(rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.5));
	}

	.pane {
		width: 100%;
		padding: 6px 12px 12px;
		border-radius: 18px;
	}

	header {
		display: flex;
		align-items: center;
		margin-right: -6px;
	}

	h2 {
		flex: 1;
		margin: 0;
		padding-left: 4px;
		font-size: 16px;
		font-weight: 600;
	}

	textarea {
		display: block;
		width: 100%;
		min-height: 96px;
		max-height: 30dvh;
		margin-top: 4px;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 12px;
		outline: none;
		background: var(--bg);
		font-size: 17px;
		line-height: 1.4;
		resize: none;
		field-sizing: content;
	}

	textarea:focus {
		border-color: var(--accent);
	}

	textarea:disabled {
		opacity: 0.6;
	}

	textarea::placeholder {
		color: var(--faint);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
	}

	.status {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 6px;
		min-width: 0;
		margin: 0;
		color: var(--muted);
		font-size: 14px;
	}

	.live {
		color: var(--alarm);
	}

	.clock {
		font-variant-numeric: tabular-nums;
	}

	.live-dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--alarm);
		animation: blink 1.2s ease-in-out infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0.25;
		}
	}

	.send {
		display: flex;
		flex: none;
		align-items: center;
		gap: 6px;
		padding: 10px 16px;
		border: 0;
		border-radius: 999px;
		background: var(--accent);
		color: #fff;
		font-size: 16px;
		font-weight: 600;
	}

	.send:disabled {
		opacity: 0.4;
	}

	.send .spinner {
		width: 16px;
		height: 16px;
		border-width: 2px;
	}

	.tucked {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		border-radius: 16px;
		color: var(--text);
		text-align: left;
	}

	.tucked-icon {
		display: grid;
		place-items: center;
		color: var(--tint);
	}

	.tucked-text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 2px;
	}

	.tucked-title {
		font-size: 15px;
		font-weight: 600;
	}

	.preview {
		overflow: hidden;
		color: var(--muted);
		font-size: 13px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.done {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		padding: 6px 4px 6px 14px;
		border-radius: 14px;
	}

	.done p {
		flex: 1;
		margin: 0;
		font-size: 15px;
		line-height: 1.35;
	}

	.undo {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 16px;
	}

	.note {
		width: 100%;
		padding: 0 14px 12px;
		border-radius: 14px;
	}

	.buttons {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.listening {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 6px 6px 6px 14px;
		border-radius: 999px;
		color: var(--muted);
		font-size: 14px;
		white-space: nowrap;
	}

	.listening .text-button {
		padding: 4px 8px;
		font-size: 15px;
	}

	.fab {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 50%;
		background: var(--group);
		box-shadow: 0 6px 20px light-dark(rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.5));
		color: var(--tint);
	}

	.fab:disabled {
		opacity: 0.4;
	}

	.mic {
		position: relative;
		flex: none;
		width: var(--size);
		height: var(--size);
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
	}

	.round {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 6px 20px light-dark(rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.5));
		color: #fff;
		transition:
			background 0.2s,
			transform 0.1s;
	}

	.actions .round {
		box-shadow: none;
	}

	.mic.live .round {
		background: var(--alarm);
	}

	.mic:active:not(:disabled) .round {
		transform: scale(0.94);
	}

	.mic:disabled:not([aria-busy='true']) {
		opacity: 0.4;
	}

	/* The ring that grows with the voice, so it is plain that the microphone hears it. */
	.halo {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: var(--alarm);
		opacity: 0;
		transition:
			transform 0.08s linear,
			opacity 0.2s;
	}

	.mic.live .halo {
		opacity: 0.25;
		transform: scale(calc(1 + var(--level) * 0.6));
	}

	.round .spinner {
		width: 22px;
		height: 22px;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: inherit;
		font-weight: 600;
	}

	.error {
		margin: 10px 4px 0;
	}
</style>
