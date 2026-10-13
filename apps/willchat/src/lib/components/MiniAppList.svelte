<script lang="ts">
	import { t } from '$lib/i18n';
	import { miniApps, questionsOf, type MiniApp } from '$lib/miniapps.svelte';
	import { runs } from '$lib/runs.svelte';
	import Bar from './Bar.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		onmenu: () => void;
		onopen: (id: string) => void;
		onnew: () => void;
	}

	let { onmenu, onopen, onnew }: Props = $props();

	function summary(app: MiniApp) {
		const questions = questionsOf(app.prompt).length;
		const parts = [`${questions} ${questions === 1 ? t.oneQuestion : t.questionCount}`];
		const images = app.inputs.filter((input) => input.kind === 'image').length;
		const files = app.inputs.length - images;
		if (images) parts.push(`${images} ${t.imageField.toLowerCase()}`);
		if (files) parts.push(`${files} ${t.fileField.toLowerCase()}`);
		return parts.join(' · ');
	}
</script>

<div class="screen">
	<Bar>
		{#snippet start()}
			<button class="icon-button" onclick={onmenu} aria-label={t.menu} title={t.menu}>
				<Icon name="menu" />
			</button>
		{/snippet}

		<h1>{t.miniApps}</h1>

		{#snippet end()}
			<button class="icon-button" onclick={onnew} aria-label={t.newMiniApp} title={t.newMiniApp}>
				<Icon name="plus" size={22} />
			</button>
		{/snippet}
	</Bar>

	<main class="scroller">
		<div class="content">
			{#if !miniApps.list.length}
				<div class="empty">
					<span class="glyph"><Icon name="spark" size={30} /></span>
					<h2>{t.miniAppsEmptyTitle}</h2>
					<p>{t.miniAppsEmptyHint}</p>
					<button class="primary" onclick={onnew}>
						<Icon name="plus" />
						{t.newMiniApp}
					</button>
				</div>
			{:else}
				<ul>
					{#each miniApps.sorted as app (app.id)}
						<li>
							<button onclick={() => onopen(app.id)}>
								<span class="glyph"><Icon name="spark" /></span>
								<span class="text">
									<span class="name">{app.name}</span>
									<span class="summary">{summary(app)}</span>
								</span>
								{#if runs.get(app.id)?.result?.status === 'pending'}
									<span class="spinner" aria-label={t.thinking}></span>
								{/if}
								<Icon name="forward" size={18} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
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
		max-width: 768px;
		min-height: 100%;
		margin: 0 auto;
		padding: 12px max(16px, env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom))
			max(16px, env(safe-area-inset-left));
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 360px;
		margin: auto;
		padding-bottom: 40px;
		text-align: center;
	}

	.empty h2 {
		margin: 16px 0 6px;
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.empty p {
		margin: 0 0 20px;
		color: var(--muted);
		line-height: 1.45;
	}

	.glyph {
		display: grid;
		flex: none;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--subtle);
	}

	.empty .glyph {
		width: 64px;
		height: 64px;
		border-radius: 20px;
	}

	.primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 18px 10px 14px;
		border: 0;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-text);
		font-weight: 500;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li button {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 10px 8px;
		border: 0;
		border-radius: 14px;
		background: transparent;
		color: var(--muted);
		text-align: left;
	}

	@media (hover: hover) {
		li button:hover {
			background: var(--hover);
		}
	}

	li button .glyph {
		color: var(--text);
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
	}

	.name,
	.summary {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name {
		color: var(--text);
		font-weight: 500;
	}

	.summary {
		font-size: 13px;
	}

	.spinner {
		width: 16px;
		height: 16px;
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
</style>
