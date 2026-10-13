<script lang="ts">
	import icon from '../../../icon.svg';
	import { pushState } from '$app/navigation';
	import { HomeButton } from '@leo-os/shared';
	import { questions } from '$lib/template';
	import { templates, titleOf, type Template } from '$lib/templates.svelte';
	import Icon from './Icon.svelte';
	import TemplateSheet from './TemplateSheet.svelte';

	let creating = $state(false);

	function open(template: Template) {
		pushState('', { template: template.id });
	}

	function count(template: Template): string {
		const asked = questions(template.body).length;
		return asked === 0 ? 'Sin preguntas' : asked === 1 ? '1 pregunta' : `${asked} preguntas`;
	}
</script>

<div class="screen">
	<header class="bar">
		<HomeButton />
	</header>

	<h1>Plantillas</h1>

	{#if templates.list.length}
		<p class="caption">Elige una plantilla para armar su prompt.</p>

		<ul class="templates">
			{#each templates.sorted as template (template.id)}
				<li>
					<button class="template" onclick={() => open(template)}>
						<span class="text">
							<span class="title">{titleOf(template)}</span>
							<span class="body">{template.body}</span>
							<span class="count">{count(template)}</span>
						</span>
						<span class="chevron"><Icon name="forward" size={18} /></span>
					</button>
				</li>
			{/each}
			<li>
				<button class="template add" onclick={() => (creating = true)} aria-haspopup="dialog">
					<Icon name="plus" />
					Nueva plantilla
				</button>
			</li>
		</ul>
	{:else}
		<div class="empty">
			<img class="logo" src={icon} alt="" width="84" height="84" />
			<p class="empty-title">Crea tu primera plantilla</p>
			<p class="empty-text">
				Una plantilla es un prompt con huecos: escribe el texto y pon entre tres corchetes,
				<code>[[[así]]]</code>, lo que quieras responder cada vez. Después la eliges, respondes y copias el
				prompt listo.
			</p>
			<button class="primary" onclick={() => (creating = true)} aria-haspopup="dialog">Nueva plantilla</button>
		</div>
	{/if}
</div>

<TemplateSheet bind:open={creating} oncreate={open} />

<style>
	.screen {
		max-width: 560px;
		margin: 0 auto;
		padding: 0 16px calc(32px + env(safe-area-inset-bottom));
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		margin: 0 -8px;
		padding-top: calc(env(safe-area-inset-top) + 6px);
	}

	h1 {
		margin: 2px 4px 0;
		font-size: 34px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.caption {
		margin: 2px 4px 20px;
		color: var(--muted);
		font-size: 15px;
	}

	.templates {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.template {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 74px;
		padding: 14px 12px 14px 18px;
		border: 0;
		border-radius: 18px;
		background: var(--group);
		box-shadow: var(--shadow);
		text-align: left;
		transition: transform 0.12s;
	}

	.template:active {
		transform: scale(0.98);
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 3px;
	}

	.title {
		overflow: hidden;
		font-size: 17px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Two lines of it: enough to tell two templates with a similar name apart. */
	.body {
		display: -webkit-box;
		overflow: hidden;
		color: var(--muted);
		font-size: 14px;
		line-height: 1.35;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.count {
		margin-top: 3px;
		color: var(--tint);
		font-size: 13px;
		font-weight: 600;
	}

	.chevron {
		color: var(--faint);
	}

	.template.add {
		justify-content: center;
		gap: 8px;
		min-height: 56px;
		border: 1.5px dashed var(--border);
		background: transparent;
		box-shadow: none;
		color: var(--tint);
		font-size: 16px;
		font-weight: 600;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 48px 12px;
		text-align: center;
	}

	.logo {
		border-radius: 22.5%;
		box-shadow: var(--shadow);
	}

	.empty-title {
		margin: 20px 0 8px;
		font-size: 20px;
		font-weight: 700;
	}

	.empty-text {
		max-width: 330px;
		margin: 0 0 24px;
		color: var(--muted);
		line-height: 1.5;
	}

	code {
		font-family: var(--mono);
		font-size: 14px;
		color: var(--tint);
	}

	.empty .primary {
		max-width: 280px;
	}
</style>
