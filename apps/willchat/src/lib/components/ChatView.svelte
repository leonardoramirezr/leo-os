<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import icon from '../../../icon.svg';
	import { chat } from '$lib/chat.svelte';
	import { t } from '$lib/i18n';
	import { apiKey, imageModel, textModel } from '$lib/settings.svelte';
	import ChatMessage from './ChatMessage.svelte';
	import Composer from './Composer.svelte';
	import Icon from './Icon.svelte';
	import ImageViewer from './ImageViewer.svelte';
	import SettingsSheet from './SettingsSheet.svelte';

	let app: HTMLElement;
	let scroller: HTMLElement;
	let thread: HTMLElement;

	let settingsOpen = $state(false);
	let viewing = $state<string | null>(null);

	/** Keep the newest content in view, unless the user scrolled up. */
	let following = true;

	onMount(() => {
		chat.load();

		const content = new ResizeObserver(() => {
			if (following) scrollToBottom();
		});
		content.observe(thread);
		content.observe(scroller);

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
			content.disconnect();
			viewport?.removeEventListener('resize', fitViewport);
			viewport?.removeEventListener('scroll', fitViewport);
		};
	});

	function scrollToBottom() {
		// `scroller` is null once the chat is closed (e.g. while changing the API key).
		if (scroller) scroller.scrollTop = scroller.scrollHeight;
	}

	function onscroll({ currentTarget: element }: UIEvent & { currentTarget: HTMLElement }) {
		// Chrome can still fire this on the detached element after the chat is closed.
		following = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
	}

	async function onsend() {
		following = true;
		await tick();
		scrollToBottom();
	}

	function newChat() {
		if (chat.messages.length && confirm(t.confirmNewChat)) chat.clear();
	}

	function changeKey() {
		apiKey.value = '';
	}
</script>

<div class="app" bind:this={app}>
	<header>
		<a
			class="icon-button"
			href="{resolve('/')}../"
			aria-label={t.apps}
			title={t.apps}
			data-sveltekit-reload
		>
			<Icon name="apps" />
		</a>

		<button class="title" onclick={() => (settingsOpen = true)} aria-haspopup="dialog">
			<span class="name">WillChat <Icon name="chevron" size={16} /></span>
			<span class="models">{textModel.value} · {imageModel.value}</span>
		</button>

		<button
			class="icon-button"
			onclick={newChat}
			disabled={!chat.messages.length}
			aria-label={t.newChat}
			title={t.newChat}
		>
			<Icon name="compose" />
		</button>
	</header>

	<main class="scroller" bind:this={scroller} {onscroll}>
		<div class="thread" bind:this={thread}>
			{#if chat.loaded && !chat.messages.length}
				<div class="empty">
					<img src={icon} alt="" width="56" height="56" />
					<h1>{t.emptyTitle}</h1>
					<p>{t.emptyHint}</p>
				</div>
			{/if}

			{#each chat.messages as message, index (message.id)}
				<ChatMessage
					{message}
					last={index === chat.messages.length - 1}
					onview={(src) => (viewing = src)}
					onchangekey={changeKey}
				/>
			{/each}
		</div>
	</main>

	<Composer {onsend} onneedgroqkey={() => (settingsOpen = true)} />
</div>

<SettingsSheet bind:open={settingsOpen} onchangekey={changeKey} />

{#if viewing}
	<ImageViewer src={viewing} onclose={() => (viewing = null)} />
{/if}

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
		justify-content: space-between;
		gap: 8px;
		padding: calc(env(safe-area-inset-top) + 6px) max(10px, env(safe-area-inset-right)) 6px
			max(10px, env(safe-area-inset-left));
	}

	.icon-button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: 12px;
		background: transparent;
		color: var(--text);
	}

	.icon-button:disabled {
		opacity: 0.3;
	}

	.title {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		padding: 3px 12px;
		border: 0;
		border-radius: 12px;
		background: transparent;
	}

	.name {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 17px;
		font-weight: 600;
		line-height: 22px;
	}

	.models {
		max-width: 100%;
		overflow: hidden;
		color: var(--muted);
		font-size: 12px;
		line-height: 16px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (hover: hover) {
		.icon-button:not(:disabled):hover,
		.title:hover {
			background: var(--hover);
		}
	}

	.scroller {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.thread {
		display: flex;
		flex-direction: column;
		gap: 24px;
		max-width: 768px;
		min-height: 100%;
		margin: 0 auto;
		padding: 12px max(16px, env(safe-area-inset-right)) 24px max(16px, env(safe-area-inset-left));
	}

	.empty {
		margin: auto;
		padding-bottom: 40px;
		text-align: center;
	}

	.empty img {
		border-radius: 22.5%;
	}

	.empty h1 {
		margin: 16px 0 6px;
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.empty p {
		margin: 0;
		color: var(--muted);
	}
</style>
