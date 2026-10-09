<script lang="ts">
	import { onMount } from 'svelte';
	import { pushState } from '$app/navigation';
	import { HomeButton } from '@leo-os/shared';
	import { draft } from '$lib/draft.svelte';
	import { titleOf, type Prompt } from '$lib/prompts.svelte';
	import { transformer } from '$lib/transformer.svelte';
	import Icon from './Icon.svelte';
	import PromptSheet from './PromptSheet.svelte';

	let { prompt }: { prompt: Prompt } = $props();

	let app: HTMLElement;
	let textarea: HTMLTextAreaElement;

	let editing = $state(false);
	let focused = $state(false);
	let copied = $state(false);
	let notice = $state('');
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	/** A touch screen: typing there brings up a keyboard that leaves little room for anything else. */
	const touch = matchMedia('(pointer: coarse)').matches;

	/** Typing on a touch screen: the tools step aside for the keyboard, and undo goes to the top. */
	const typing = $derived(focused && touch);

	const title = $derived(titleOf(prompt));
	const hasText = $derived(draft.text.trim() !== '');
	const working = $derived(transformer.busy);

	onMount(() => {
		// What another prompt said, or this one the last time, is about another moment.
		if (!transformer.busy) transformer.forget();

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

	function transform() {
		textarea.blur();
		transformer.run(prompt);
	}

	function undo() {
		draft.undo();
		transformer.forget();
	}

	function redo() {
		draft.redo();
		transformer.forget();
	}

	function showChanges() {
		pushState('', { prompt: prompt.id, changes: true });
	}

	function oninput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		draft.type(event.currentTarget.value);
		transformer.forget();
	}

	async function paste() {
		let clip = '';
		try {
			clip = await navigator.clipboard.readText();
		} catch {
			// Not allowed, or not offered: the text's own menu still pastes.
			show('No se pudo pegar. Mantén presionado el recuadro y elige «Pegar».');
			textarea.focus();
			return;
		}
		if (!clip.trim()) {
			show('No hay texto copiado para pegar.');
			return;
		}
		draft.set(clip);
		transformer.forget();
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

	/** Empties the text for the next one, with «Pegar» at hand. No question asked: undo brings it back. */
	function clear() {
		draft.set('');
		transformer.forget();
	}

	function show(message: string) {
		notice = message;
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 4000);
	}

	/**
	 * ⌘Z and ⇧⌘Z (Ctrl on the others) are the buttons' undo and redo, which every version is part of;
	 * ⌘/Ctrl + Enter transforms.
	 */
	function onkeydown(event: KeyboardEvent) {
		if (!(event.metaKey || event.ctrlKey) || event.altKey || working) return;
		// Other fields keep their own, and so does everything while a sheet is open.
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (target !== textarea && target?.closest('input, textarea, select, [contenteditable], dialog')) return;

		const key = event.key.toLowerCase();
		if (key === 'enter') {
			event.preventDefault();
			if (hasText) transform();
		} else if (key === 'z') {
			event.preventDefault();
			if (event.shiftKey) redo();
			else undo();
		} else if (key === 'y' && event.ctrlKey) {
			event.preventDefault();
			redo();
		}
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
				<button class="icon-button" type="button" onclick={() => history.back()} aria-label="Prompts" title="Prompts">
					<Icon name="back" size={26} />
				</button>
			{/if}
		</div>

		<h1>{title}</h1>

		<div class="side end">
			{#if typing}
				<button class="text-button strong" type="button" onclick={() => textarea.blur()}>Listo</button>
			{:else}
				<button
					class="icon-button"
					type="button"
					onclick={() => (editing = true)}
					aria-label="Editar prompt"
					title="Editar prompt"
					aria-haspopup="dialog"
				>
					<Icon name="edit" />
				</button>
			{/if}
			<HomeButton />
		</div>
	</header>

	<main>
		<div class="page" class:working>
			<textarea
				bind:this={textarea}
				value={draft.text}
				readonly={working}
				aria-label="Texto"
				placeholder={focused ? 'Escribe o pega el texto…' : ''}
				autocapitalize="sentences"
				{oninput}
				onfocus={() => (focused = true)}
				onblur={() => {
					focused = false;
					draft.settle();
				}}
			></textarea>

			{#if !draft.text && !focused}
				<!-- Under the taps, which go to the text, except for the button: it can be typed in as well. -->
				<div class="empty">
					<p class="empty-title">Pega o escribe el texto</p>
					<p class="empty-text">Al tocar Transformar, se reescribe como dice «{title}».</p>
					<button class="paste" type="button" onclick={paste}>
						<Icon name="paste" size={18} />
						Pegar
					</button>
				</div>
			{/if}
		</div>
	</main>

	<footer>
		<div class="status" role="status">
			{#if transformer.error}
				<p class="problem">
					{transformer.error}
					{#if transformer.keyRefused}
						<button class="link" type="button" onclick={() => transformer.changeKey()}>Cambiar API key</button>
					{/if}
				</p>
			{:else if transformer.notice}
				<p>{transformer.notice}</p>
			{:else if notice}
				<p>{notice}</p>
			{/if}
		</div>

		{#if !typing}
			<div class="tools">
				<button class="tool" type="button" onclick={undo} disabled={!draft.canUndo || working}>
					<Icon name="undo" size={22} />
					<span>Deshacer</span>
				</button>
				<button class="tool" type="button" onclick={redo} disabled={!draft.canRedo || working}>
					<Icon name="redo" size={22} />
					<span>Rehacer</span>
				</button>
				<button class="tool" type="button" onclick={showChanges} disabled={!draft.comparison || working}>
					<Icon name="changes" size={22} />
					<span>Cambios</span>
				</button>
				<button class="tool" type="button" onclick={copy} disabled={!hasText}>
					<Icon name={copied ? 'check' : 'copy'} size={22} />
					<span>{copied ? 'Copiado' : 'Copiar'}</span>
				</button>
				<button class="tool" type="button" onclick={clear} disabled={!draft.text || working}>
					<Icon name="trash" size={22} />
					<span>Borrar</span>
				</button>
			</div>
		{/if}

		<button
			class="primary transform"
			type="button"
			onmousedown={keepFocus}
			onclick={transform}
			disabled={!hasText || working}
			aria-busy={working}
		>
			{#if working}
				<span class="spinner" aria-hidden="true"></span>
				Transformando…
			{:else}
				<Icon name="sparkles" />
				Transformar
			{/if}
		</button>
	</footer>
</div>

<PromptSheet bind:open={editing} {prompt} />

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
		display: flex;
		flex: none;
		align-items: center;
		gap: 8px;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: calc(env(safe-area-inset-top) + 6px) max(10px, env(safe-area-inset-right)) 6px
			max(10px, env(safe-area-inset-left));
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

	/* Being rewritten: it is about to change, and cannot be typed in meanwhile. */
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

	.empty-title {
		margin: 0 0 6px;
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

	.paste {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 18px;
		padding: 10px 18px;
		border: 0;
		border-radius: 999px;
		background: var(--hover);
		color: var(--tint);
		font-size: 16px;
		font-weight: 600;
		pointer-events: auto;
	}

	footer {
		flex: none;
		width: 100%;
		max-width: 760px;
		margin: 0 auto;
		padding: 0 max(12px, env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom))
			max(12px, env(safe-area-inset-left));
	}

	.status p {
		margin: 10px 6px 0;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.4;
		text-align: center;
	}

	.status .problem {
		color: var(--danger);
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: inherit;
		font-weight: 600;
	}

	.tools {
		display: flex;
		justify-content: space-around;
		margin: 6px 0 0;
	}

	.tool {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		min-width: 0;
		padding: 8px 2px 6px;
		border: 0;
		border-radius: 12px;
		background: none;
		color: var(--tint);
		font-size: 11px;
		font-weight: 500;
	}

	.tool:disabled {
		color: var(--faint);
		opacity: 0.5;
	}

	@media (hover: hover) {
		.tool:hover:not(:disabled) {
			background: var(--hover);
		}
	}

	.transform {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-top: 8px;
	}
</style>
