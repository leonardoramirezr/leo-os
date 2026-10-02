<script lang="ts">
	import { draft } from '$lib/draft.svelte';
	import { improving } from '$lib/settings.svelte';
	import { voice } from '$lib/voice.svelte';
	import Icon from './Icon.svelte';
	import Switch from './Switch.svelte';

	let {
		notice = '',
		onprompt,
		onchanges
	}: { notice?: string; onprompt: () => void; onchanges: () => void } = $props();

	const recording = $derived(voice.phase === 'recording');
	const dictating = $derived(voice.mode === 'dictate');
	/** The button whose work is under way: it keeps its colour and shows a spinner. */
	const busyWith = $derived(voice.busy ? voice.mode : undefined);
	const hasText = $derived(draft.text.trim() !== '');
	const clock = $derived(`${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, '0')}`);

	function undo() {
		draft.undo();
		voice.forget();
	}

	function redo() {
		draft.redo();
		voice.forget();
	}
</script>

<footer class="bar">
	<div class="status" role="status">
		{#if voice.phase === 'starting'}
			<p>Abriendo el micrófono…</p>
		{:else if recording}
			<p class="live">{dictating ? 'Escuchando' : 'Di qué cambiar'} · <span class="clock">{clock}</span></p>
			{#if !dictating}
				<p class="example">Por ejemplo: «hazlo más formal» o «quita la última frase»</p>
			{/if}
		{:else}
			{#if voice.heard}
				<p class="heard">«{voice.heard}»</p>
			{/if}

			{#if voice.phase === 'transcribing'}
				<p>Transcribiendo…</p>
			{:else if voice.phase === 'improving'}
				<p>Mejorando el texto…</p>
			{:else if voice.phase === 'editing'}
				<p>Editando el texto…</p>
			{:else if voice.error}
				<p class="problem">
					{voice.error}
					{#if voice.keyRefused}
						<button class="link" type="button" onclick={() => voice.changeKey()}>Cambiar API key</button>
					{/if}
				</p>
			{:else if voice.reply || notice || draft.comparison}
				<p>
					{voice.reply || notice}
					{#if draft.comparison}
						<button class="link" type="button" onclick={onchanges}>Ver cambios</button>
					{/if}
				</p>
			{/if}
		{/if}
	</div>

	<div class="auto-improve">
		<label class="toggle">
			<Switch bind:checked={improving.value} />
			<span>Mejorar texto</span>
		</label>
		<button class="instructions" type="button" onclick={onprompt} aria-haspopup="dialog">
			Instrucciones <Icon name="forward" size={15} stroke={2.4} />
		</button>
	</div>

	<div class="controls">
		<div class="side">
			{#if recording}
				<button class="action" type="button" onclick={() => voice.cancel()}>
					<span class="round"><Icon name="close" /></span>
					<span class="label">Cancelar</span>
				</button>
			{:else if hasText || draft.canUndo || draft.canRedo}
				<div class="history">
					<button
						class="round small"
						type="button"
						onclick={undo}
						disabled={!draft.canUndo || voice.busy}
						aria-label="Deshacer"
						title="Deshacer"
					>
						<Icon name="undo" />
					</button>
					<button
						class="round small"
						type="button"
						onclick={redo}
						disabled={!draft.canRedo || voice.busy}
						aria-label="Rehacer"
						title="Rehacer"
					>
						<Icon name="redo" />
					</button>
				</div>
			{/if}
		</div>

		<button
			class="action mic"
			class:live={recording && dictating}
			type="button"
			disabled={voice.busy || (recording && !dictating)}
			aria-busy={busyWith === 'dictate'}
			style:--level={voice.level}
			onclick={() => voice.toggle('dictate')}
		>
			<span class="halo" aria-hidden="true"></span>
			<span class="round">
				{#if busyWith === 'dictate'}
					<span class="spinner" aria-hidden="true"></span>
				{:else if recording && dictating}
					<Icon name="stop" size={30} />
				{:else}
					<Icon name="mic" size={30} />
				{/if}
			</span>
			<span class="label">{recording && dictating ? 'Listo' : hasText ? 'Añadir' : 'Dictar'}</span>
		</button>

		<div class="side">
			{#if hasText}
				<button
					class="action improve"
					type="button"
					disabled={voice.phase !== 'idle'}
					aria-busy={busyWith === 'improve'}
					onclick={() => voice.improve()}
				>
					<span class="round">
						{#if busyWith === 'improve'}
							<span class="spinner" aria-hidden="true"></span>
						{:else}
							<Icon name="sparkles" size={24} />
						{/if}
					</span>
					<span class="label">Mejorar</span>
				</button>
				<button
					class="action edit"
					class:live={recording && !dictating}
					type="button"
					disabled={voice.busy || (recording && dictating)}
					aria-busy={busyWith === 'edit'}
					style:--level={voice.level}
					onclick={() => voice.toggle('edit')}
				>
					<span class="halo" aria-hidden="true"></span>
					<span class="round">
						{#if busyWith === 'edit'}
							<span class="spinner" aria-hidden="true"></span>
						{:else if recording && !dictating}
							<Icon name="stop" size={24} />
						{:else}
							<Icon name="wand" size={24} />
						{/if}
					</span>
					<span class="label">{recording && !dictating ? 'Listo' : 'Editar'}</span>
				</button>
			{/if}
		</div>
	</div>
</footer>

<style>
	.bar {
		flex: none;
		padding: 8px 16px calc(14px + env(safe-area-inset-bottom));
	}

	.status {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-width: 528px;
		min-height: 20px;
		margin: 0 auto 8px;
		color: var(--muted);
		font-size: 15px;
		line-height: 20px;
		text-align: center;
	}

	.status p {
		margin: 0;
	}

	.heard {
		display: -webkit-box;
		overflow: hidden;
		font-style: italic;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}

	.live {
		color: var(--live);
	}

	.clock {
		font-variant-numeric: tabular-nums;
	}

	.example {
		font-size: 13px;
	}

	.problem {
		color: var(--danger);
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font-weight: 600;
	}

	/* The switch, and the way to what it asks the model for. */
	.auto-improve {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
		max-width: 420px;
		margin: 0 auto 12px;
		padding: 8px 14px 8px 8px;
		border-radius: 18px;
		background: var(--group);
		box-shadow: var(--shadow);
	}

	.toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 16px;
		font-weight: 500;
		cursor: pointer;
	}

	.instructions {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px 0;
		border: 0;
		background: none;
		color: var(--tint);
		font-size: 15px;
	}

	.controls {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: start;
		max-width: 420px;
		margin: 0 auto;
	}

	.side {
		display: flex;
		justify-content: center;
		gap: 8px;
	}

	/* Centred on the microphone, like the other buttons, whose labels hang below. */
	.history {
		display: flex;
		gap: 10px;
		margin-top: 14px;
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
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: var(--group);
		box-shadow: var(--shadow);
		color: var(--text);
		transition:
			background 0.2s,
			opacity 0.2s,
			transform 0.1s;
	}

	.small {
		width: 44px;
		height: 44px;
		margin: 0;
	}

	.mic .round {
		width: 72px;
		height: 72px;
		margin: 0;
		background: var(--accent);
		color: #fff;
	}

	/* Two of them side by side, between the microphone and the edge of a small phone. */
	.improve .round,
	.edit .round {
		width: 52px;
		height: 52px;
		margin: 10px 0;
		color: var(--tint);
	}

	.live .round {
		background: var(--live);
		color: #fff;
	}

	.action:active:not(:disabled) .round,
	.small:active:not(:disabled) {
		transform: scale(0.94);
	}

	/* Dimmed while the other microphone has the floor; the one at work keeps its colour. */
	.action:disabled:not([aria-busy='true']) .round,
	.small:disabled {
		opacity: 0.35;
	}

	/* The ring that grows with the voice, so it is plain that the microphone hears it. */
	.halo {
		position: absolute;
		top: var(--top, 0);
		left: 50%;
		width: var(--size);
		height: var(--size);
		margin-left: calc(var(--size) / -2);
		border-radius: 50%;
		background: var(--live);
		opacity: 0;
		transition:
			transform 0.08s linear,
			opacity 0.2s;
	}

	.mic .halo {
		--size: 72px;
	}

	.edit .halo {
		--size: 52px;
		--top: 10px;
	}

	.live .halo {
		opacity: 0.25;
		transform: scale(calc(1 + var(--level) * 0.6));
	}

	.label {
		color: var(--muted);
		font-size: 13px;
	}

	.mic .spinner {
		width: 26px;
		height: 26px;
		border-width: 3px;
	}
</style>
