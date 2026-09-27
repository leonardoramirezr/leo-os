<script lang="ts">
	import { list } from '$lib/list.svelte';
	import { voice } from '$lib/voice.svelte';
	import Icon from './Icon.svelte';

	const recording = $derived(voice.phase === 'recording');
	const clock = $derived(`${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, '0')}`);
</script>

<footer class="bar">
	<div class="feedback" role="status">
		{#if voice.phase === 'starting'}
			<p class="status">Abriendo el micrófono…</p>
		{:else if recording}
			<p class="status live">Escuchando · <span class="clock">{clock}</span></p>
		{:else}
			{#if voice.heard}
				<p class="heard">«{voice.heard}»</p>
			{/if}

			{#if voice.phase === 'transcribing'}
				<p class="status">Transcribiendo…</p>
			{:else if voice.phase === 'thinking'}
				<p class="status">Pensando…</p>
			{:else if voice.error}
				<p class="error">
					{voice.error}
					{#if voice.keyRefused}
						<button class="link" onclick={() => voice.changeKey()}>Cambiar API key</button>
					{/if}
				</p>
			{:else if voice.reply}
				<p class="reply">{voice.reply}</p>
			{:else}
				<p class="status">Toca el micrófono para hablar</p>
			{/if}
		{/if}
	</div>

	<div class="controls">
		<div class="side">
			{#if recording}
				<button class="action" onclick={() => voice.cancel()}>
					<span class="round"><Icon name="close" /></span>
					<span class="label">Cancelar</span>
				</button>
			{/if}
		</div>

		<button
			class="action mic"
			class:live={recording}
			disabled={voice.busy}
			aria-busy={voice.busy}
			style:--level={voice.level}
			onclick={() => voice.toggle()}
		>
			<span class="halo" aria-hidden="true"></span>
			<span class="round">
				{#if voice.busy}
					<span class="spinner" aria-hidden="true"></span>
				{:else if recording}
					<Icon name="stop" size={30} />
				{:else}
					<Icon name="mic" size={30} />
				{/if}
			</span>
			<span class="label">{recording ? 'Listo' : 'Hablar'}</span>
		</button>

		<div class="side">
			{#if list.canUndo && voice.phase === 'idle'}
				<button class="action" onclick={() => voice.undo()}>
					<span class="round"><Icon name="undo" /></span>
					<span class="label">Deshacer</span>
				</button>
			{/if}
		</div>
	</div>
</footer>

<style>
	.bar {
		position: fixed;
		right: 0;
		bottom: 0;
		left: 0;
		padding: 12px 16px calc(14px + env(safe-area-inset-bottom));
		border-top: 1px solid var(--border);
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.feedback {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-width: 528px;
		min-height: 20px;
		margin: 0 auto 12px;
		font-size: 15px;
		line-height: 20px;
		text-align: center;
	}

	.feedback p {
		margin: 0;
	}

	.heard {
		display: -webkit-box;
		overflow: hidden;
		color: var(--muted);
		font-style: italic;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	.status {
		color: var(--muted);
	}

	.live {
		color: var(--live);
	}

	.clock {
		font-variant-numeric: tabular-nums;
	}

	.error {
		color: var(--danger);
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font-weight: 600;
	}

	.controls {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		max-width: 360px;
		margin: 0 auto;
	}

	.side {
		display: flex;
		justify-content: center;
	}

	.action {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 0;
		border: 0;
		background: none;
	}

	.round {
		position: relative;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		/* Centred on the microphone, with the labels lined up underneath. */
		margin: 12px 0;
		border-radius: 50%;
		background: var(--group);
		box-shadow: var(--shadow);
		color: var(--text);
		transition:
			background 0.2s,
			transform 0.1s;
	}

	.mic .round {
		width: 72px;
		height: 72px;
		margin: 0;
		background: var(--accent);
		color: #fff;
	}

	.mic.live .round {
		background: var(--live);
	}

	.action:active .round {
		transform: scale(0.94);
	}

	/* The ring that grows with the voice, so it is plain that the microphone hears it. */
	.halo {
		position: absolute;
		top: 0;
		left: 50%;
		width: 72px;
		height: 72px;
		margin-left: -36px;
		border-radius: 50%;
		background: var(--live);
		opacity: 0;
		transition:
			transform 0.08s linear,
			opacity 0.2s;
	}

	.mic.live .halo {
		opacity: 0.25;
		transform: scale(calc(1 + var(--level) * 0.6));
	}

	.label {
		color: var(--muted);
		font-size: 13px;
	}

	.spinner {
		width: 26px;
		height: 26px;
		border: 3px solid rgb(255 255 255 / 0.35);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
