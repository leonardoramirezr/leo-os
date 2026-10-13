<script lang="ts">
	import { chat } from '$lib/chat.svelte';
	import type { Message } from '$lib/conversation';
	import { t } from '$lib/i18n';
	import { saveImage } from '$lib/images';
	import { renderMarkdown } from '$lib/markdown';
	import Icon from './Icon.svelte';

	interface Props {
		message: Message;
		/** Only the last message offers to retry. */
		last: boolean;
		onview: (src: string) => void;
		onchangekey: () => void;
		/** What «Retry» does: the chat's own, unless a mini app shows its result here. */
		onretry?: () => void;
	}

	let { message, last, onview, onchangekey, onretry = () => chat.retry() }: Props = $props();

	const html = $derived(message.role === 'assistant' && message.text ? renderMarkdown(message.text) : '');

	let now = $state(Date.now());
	const seconds = $derived(
		message.role === 'assistant' ? Math.max(0, Math.round((now - message.startedAt) / 1000)) : 0
	);

	$effect(() => {
		if (message.role !== 'assistant' || message.status !== 'pending') return;
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
</script>

{#if message.role === 'user'}
	<article class="user">
		{#if message.images.length}
			<div class="photos" class:single={message.images.length === 1}>
				{#each message.images as src, index (index)}
					<button class="photo" onclick={() => onview(src)}>
						<img {src} alt={t.attachedPhoto} />
					</button>
				{/each}
			</div>
		{/if}
		{#if message.text}
			<p class="bubble">{message.text}</p>
		{/if}
	</article>
{:else}
	<article class="assistant">
		{#if message.status === 'pending'}
			{#if message.phase === 'image'}
				<div class="placeholder">
					<span class="shimmer">{t.creatingImage}</span>
					<span class="seconds">{seconds}s</span>
				</div>
			{:else}
				<p class="status">
					<span class="shimmer">{t.thinking}</span>
					<span class="seconds">{seconds}s</span>
				</p>
			{/if}
		{/if}

		{#each message.images as image, index (index)}
			<figure>
				<button class="image" onclick={() => onview(image.url)}>
					<img src={image.url} alt={t.generatedImage} />
				</button>
				<figcaption>
					<button class="action" onclick={() => saveImage(image.url)}>
						<Icon name="download" size={18} />
						{t.save}
					</button>
				</figcaption>
			</figure>
		{/each}

		{#if html}
			<div class="markdown">{@html html}</div>
		{/if}

		{#if message.notice}
			<p class="notice">{message.notice}</p>
		{/if}

		{#if message.status === 'cancelled'}
			<p class="notice">{t.stopped}</p>
		{:else if message.status === 'failed'}
			<div class="error" role="alert">
				<p>{message.error?.message ?? t.failed}</p>
				{#if last}
					<div class="error-actions">
						{#if message.error?.auth}
							<button onclick={onchangekey}>{t.updateKey}</button>
						{/if}
						<button onclick={onretry}>{t.retry}</button>
					</div>
				{/if}
			</div>
		{/if}
	</article>
{/if}

<style>
	article {
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	button {
		padding: 0;
		border: 0;
		background: none;
	}

	/* User */

	.user {
		align-items: flex-end;
	}

	.bubble {
		max-width: min(85%, 560px);
		margin: 0;
		padding: 10px 16px;
		border-radius: 22px;
		background: var(--bubble);
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.photos {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 6px;
		max-width: 85%;
	}

	.photo {
		overflow: hidden;
		width: 112px;
		height: 112px;
		border-radius: 16px;
	}

	.photo img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.single .photo {
		width: auto;
		height: auto;
	}

	.single .photo img {
		width: auto;
		max-width: min(240px, 100%);
		max-height: 320px;
	}

	/* Assistant */

	.assistant {
		align-items: flex-start;
		line-height: 1.65;
	}

	.status {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin: 0;
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

	.seconds {
		color: var(--muted);
		font-size: 13px;
		font-variant-numeric: tabular-nums;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: min(100%, 360px);
		aspect-ratio: 1;
		border-radius: 20px;
		background: linear-gradient(110deg, var(--subtle) 35%, var(--hover) 50%, var(--subtle) 65%);
		background-size: 200% 100%;
		animation: shimmer 2s linear infinite;
	}

	figure {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: min(100%, 440px);
		margin: 0;
	}

	.image {
		display: block;
		overflow: hidden;
		border-radius: 20px;
	}

	.image img {
		display: block;
		width: 100%;
		height: auto;
	}

	.action {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		margin-left: -8px;
		border-radius: 8px;
		color: var(--muted);
		font-size: 14px;
	}

	@media (hover: hover) {
		.action:hover {
			background: var(--hover);
			color: var(--text);
		}
	}

	.notice {
		margin: 0;
		color: var(--muted);
		font-size: 14px;
		font-style: italic;
	}

	.error {
		align-self: stretch;
		padding: 12px 14px;
		border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
		border-radius: 14px;
		background: color-mix(in srgb, var(--danger) 8%, transparent);
		font-size: 15px;
		line-height: 1.5;
	}

	.error p {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.error-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}

	.error-actions button {
		padding: 7px 14px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		font-size: 14px;
		font-weight: 500;
	}

	/* Markdown */

	.markdown {
		max-width: 100%;
		overflow-wrap: anywhere;
	}

	.markdown > :global(:first-child) {
		margin-top: 0;
	}

	.markdown > :global(:last-child) {
		margin-bottom: 0;
	}

	.markdown :global(p),
	.markdown :global(ul),
	.markdown :global(ol),
	.markdown :global(pre),
	.markdown :global(blockquote),
	.markdown :global(table) {
		margin: 0 0 14px;
	}

	.markdown :global(h1),
	.markdown :global(h2),
	.markdown :global(h3),
	.markdown :global(h4) {
		margin: 22px 0 10px;
		line-height: 1.3;
	}

	.markdown :global(h1) {
		font-size: 1.5em;
	}

	.markdown :global(h2) {
		font-size: 1.3em;
	}

	.markdown :global(h3) {
		font-size: 1.12em;
	}

	.markdown :global(ul),
	.markdown :global(ol) {
		padding-left: 1.5em;
	}

	.markdown :global(li + li) {
		margin-top: 4px;
	}

	.markdown :global(a) {
		color: inherit;
		text-decoration-color: var(--muted);
		text-underline-offset: 2px;
	}

	.markdown :global(code) {
		font-family: var(--mono);
		font-size: 0.875em;
	}

	.markdown :global(:not(pre) > code) {
		padding: 2px 5px;
		border-radius: 6px;
		background: var(--subtle);
	}

	.markdown :global(pre) {
		overflow-x: auto;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--subtle);
		line-height: 1.5;
	}

	.markdown :global(blockquote) {
		padding-left: 14px;
		border-left: 3px solid var(--border);
		color: var(--muted);
	}

	.markdown :global(table) {
		display: block;
		overflow-x: auto;
		border-collapse: collapse;
	}

	.markdown :global(th),
	.markdown :global(td) {
		padding: 6px 10px;
		border: 1px solid var(--border);
	}

	.markdown :global(img) {
		max-width: 100%;
		border-radius: 12px;
	}

	.markdown :global(hr) {
		border: 0;
		border-top: 1px solid var(--border);
	}
</style>
