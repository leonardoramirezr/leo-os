<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import icon from '../../../icon.svg';
	import { draft } from '$lib/draft.svelte';
	import { voice } from '$lib/voice.svelte';
	import Icon from './Icon.svelte';
	import ImproveSheet from './ImproveSheet.svelte';
	import SettingsSheet from './SettingsSheet.svelte';
	import VoiceBar from './VoiceBar.svelte';

	let app: HTMLElement;
	let textarea: HTMLTextAreaElement;

	let settingsOpen = $state(false);
	let improveOpen = $state(false);
	let focused = $state(false);
	let copied = $state(false);
	let notice = $state('');
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	/** A touch screen: typing there brings up a keyboard that leaves little room for anything else. */
	const touch = matchMedia('(pointer: coarse)').matches;

	/** Typing on a touch screen: the voice bar steps aside for the keyboard, unless it is listening. */
	const typing = $derived(focused && touch && voice.phase === 'idle');

	const hasText = $derived(draft.text.trim() !== '');
	const working = $derived(voice.phase === 'improving' || voice.phase === 'editing');

	onMount(() => {
		// iOS Safari doesn't shrink the layout when the keyboard opens, so size the app to what's visible.
		const viewport = window.visualViewport;
		const fitViewport = () => {
			if (!viewport || viewport.scale > 1.01) {
				app.style.height = '';
				app.style.transform = '';
			} else {
				app.style.height = `${viewport.height}px`;
				app.style.transform = `translateY(${viewport.offsetTop}px)`;
			}
		};
		fitViewport();
		viewport?.addEventListener('resize', fitViewport);
		viewport?.addEventListener('scroll', fitViewport);

		return () => {
			viewport?.removeEventListener('resize', fitViewport);
			viewport?.removeEventListener('scroll', fitViewport);
		};
	});

	$effect(() => {
		const onvisibility = () => {
			if (document.visibilityState === 'hidden') {
				voice.interrupt();
				draft.flush();
			} else if (voice.phase === 'idle') {
				draft.refresh();
			}
		};
		document.addEventListener('visibilitychange', onvisibility);
		return () => {
			document.removeEventListener('visibilitychange', onvisibility);
			// Leaving the screen, to change the API key for instance, closes the microphone.
			voice.cancel();
		};
	});

	// A dictation lands at the end of the text, which may be out of sight: it is scrolled to.
	$effect(() => {
		if (!voice.landed) return;
		tick().then(() => textarea?.scrollTo({ top: textarea.scrollHeight, behavior: 'smooth' }));
	});

	function undo() {
		draft.undo();
		voice.forget();
	}

	function redo() {
		draft.redo();
		voice.forget();
	}

	function oninput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		draft.type(event.currentTarget.value);
		voice.forget();
	}

	/** ⌘Z and ⇧⌘Z (Ctrl on the others) are the buttons' undo and redo, which the voice's changes are part of. */
	function onkeydown(event: KeyboardEvent) {
		if (!(event.metaKey || event.ctrlKey) || event.altKey || voice.busy) return;
		// Other fields keep their own, and so does everything while a sheet is open.
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (target !== textarea && target?.closest('input, textarea, select, [contenteditable], dialog')) return;

		const key = event.key.toLowerCase();
		if (key === 'z') {
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
		} else if (key === 'y' && event.ctrlKey) {
			event.preventDefault();
			redo();
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(draft.text);
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 1500);
		} catch {
			show('No se pudo copiar. Mantén presionado el texto para copiarlo a mano.');
		}
	}

	function startOver() {
		if (!confirm('¿Borrar el texto y empezar uno nuevo?')) return;
		draft.set('');
		voice.forget();
	}

	function show(message: string) {
		notice = message;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 4000);
	}

	/** Keeps the focus in the text, so that a tap on the bar above the keyboard does not put it away. */
	function keepFocus(event: MouseEvent) {
		event.preventDefault();
	}
</script>

<svelte:window {onkeydown} />

<div class="app" bind:this={app}>
	<header>
		<div class="side">
			{#if typing}
				<button
					class="icon-button"
					type="button"
					onmousedown={keepFocus}
					onclick={undo}
					disabled={!draft.canUndo}
					aria-label="Deshacer"
					title="Deshacer"
				>
					<Icon name="undo" />
				</button>
				<button
					class="icon-button"
					type="button"
					onmousedown={keepFocus}
					onclick={redo}
					disabled={!draft.canRedo}
					aria-label="Rehacer"
					title="Rehacer"
				>
					<Icon name="redo" />
				</button>
			{:else}
				<a class="icon-button" href="{resolve('/')}../" aria-label="Apps" title="Apps" data-sveltekit-reload>
					<Icon name="apps" />
				</a>
			{/if}
		</div>

		<h1>Dictado</h1>

		<div class="side end">
			{#if typing}
				<button class="text-button strong" type="button" onclick={() => textarea.blur()}>Listo</button>
			{:else}
				{#if hasText}
					<button
						class="icon-button"
						type="button"
						onclick={copy}
						aria-label={copied ? 'Copiado' : 'Copiar'}
						title={copied ? 'Copiado' : 'Copiar'}
					>
						<Icon name={copied ? 'check' : 'copy'} />
					</button>
					<button
						class="icon-button"
						type="button"
						onclick={startOver}
						disabled={voice.phase !== 'idle'}
						aria-label="Texto nuevo"
						title="Texto nuevo"
					>
						<Icon name="compose" />
					</button>
				{/if}
				<button
					class="icon-button"
					type="button"
					onclick={() => (settingsOpen = true)}
					aria-label="Ajustes"
					title="Ajustes"
					aria-haspopup="dialog"
				>
					<Icon name="settings" />
				</button>
			{/if}
		</div>
	</header>

	<main class:typing>
		<div class="page" class:working>
			<textarea
				bind:this={textarea}
				value={draft.text}
				readonly={voice.busy}
				aria-label="Texto"
				placeholder={focused ? 'Escribe o dicta…' : ''}
				autocapitalize="sentences"
				{oninput}
				onfocus={() => (focused = true)}
				onblur={() => {
					focused = false;
					draft.settle();
				}}
			></textarea>

			{#if !hasText && !focused}
				<!-- Under the taps, which go to the text: it can be typed in as well as dictated. -->
				<div class="empty" aria-hidden="true">
					<img src={icon} alt="" width="60" height="60" />
					<p class="empty-title">Toca el micrófono y habla</p>
					<p class="empty-text">
						Lo que digas aparece aquí, listo para copiar. Después puedes seguir dictando, o decir qué
						cambiar con «Editar».
					</p>
				</div>
			{/if}
		</div>
	</main>

	{#if !typing}
		<VoiceBar {notice} onprompt={() => (improveOpen = true)} />
	{/if}
</div>

<SettingsSheet bind:open={settingsOpen} />
<ImproveSheet bind:open={improveOpen} />

<style>
	.app {
		position: fixed;
		top: 0;
		right: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}

	header {
		display: grid;
		flex: none;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 8px;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(env(safe-area-inset-top) + 6px) max(10px, env(safe-area-inset-right)) 6px
			max(10px, env(safe-area-inset-left));
	}

	.side {
		display: flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}

	.side.end {
		justify-content: flex-end;
	}

	h1 {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
	}

	.text-button {
		padding: 8px 6px;
	}

	main {
		display: flex;
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: 2px max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left));
	}

	/* The keyboard is right below: the text goes down to it. */
	main.typing {
		padding-bottom: 8px;
	}

	/* The text, which is what the screen is for: everything else fits around it. */
	.page {
		position: relative;
		display: flex;
		flex: 1;
		min-width: 0;
		border-radius: 20px;
		background: var(--group);
		box-shadow: var(--shadow);
	}

	textarea {
		flex: 1;
		width: 100%;
		min-height: 0;
		margin: 0;
		padding: 18px 18px 24px;
		border: 0;
		border-radius: inherit;
		outline: none;
		background: transparent;
		font-size: 17px;
		line-height: 1.55;
		resize: none;
		overscroll-behavior: contain;
	}

	textarea::placeholder {
		color: var(--faint);
	}

	/* Rewritten by the model: it is about to change, and cannot be typed in meanwhile. */
	.working textarea {
		animation: working 1.4s ease-in-out infinite alternate;
	}

	@keyframes working {
		from {
			opacity: 1;
		}
		to {
			opacity: 0.45;
		}
	}

	.empty {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24px 32px 40px;
		text-align: center;
		pointer-events: none;
	}

	.empty img {
		border-radius: 22.5%;
		box-shadow: var(--shadow);
	}

	.empty-title {
		margin: 18px 0 6px;
		font-size: 20px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.empty-text {
		max-width: 300px;
		margin: 0;
		color: var(--muted);
		font-size: 15px;
		line-height: 1.45;
	}
</style>
