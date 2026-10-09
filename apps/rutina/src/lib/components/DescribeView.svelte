<script lang="ts">
	// A new routine described in one's own words: typed in the box, or dictated with the microphone,
	// which adds what Whisper writes down to the box once the recording stops. A chat model on Groq —
	// the one picked here or in Ajustes — writes the routine from it, and the editor opens with the
	// result: nothing is saved until it has been looked over there. Back from the editor, the
	// description is still here, to say more and try again.
	import { onMount } from 'svelte';
	import { HomeButton } from '@leo-os/shared';
	import { Dictation } from '$lib/dictation.svelte';
	import { formatClock } from '$lib/format';
	import { describe, GroqError } from '$lib/groq';
	import { apiKey, model, refreshModels } from '$lib/settings.svelte';
	import { writeRoutine, type Written } from '$lib/writer';
	import EditorView from './EditorView.svelte';
	import GroqKeyField from './GroqKeyField.svelte';
	import Icon from './Icon.svelte';
	import ModelField from './ModelField.svelte';

	let text = $state('');
	let step = $state<'write' | 'writing' | 'review'>('write');
	let written = $state.raw<Written>();
	let error = $state('');
	let keyRefused = $state(false);
	/** Goes up with every request, and with «back» while one is on its way: an answer after that is dropped. */
	let attempt = 0;

	const dictation = new Dictation((heard) => {
		// Each recording on a line of its own, after whatever was typed or dictated before.
		const before = text.trimEnd();
		text = before ? `${before}\n${heard}` : heard;
	});

	const recording = $derived(dictation.phase === 'recording');

	onMount(() => {
		refreshModels();

		const onhide = () => {
			if (document.visibilityState === 'hidden') dictation.interrupt();
		};
		document.addEventListener('visibilitychange', onhide);
		return () => {
			document.removeEventListener('visibilitychange', onhide);
			dictation.dispose();
		};
	});

	function back() {
		if (step === 'writing') {
			attempt++;
			step = 'write';
			return;
		}
		history.back();
	}

	async function write() {
		const description = text.trim();
		if (!description || dictation.phase !== 'idle') return;

		const current = ++attempt;
		step = 'writing';
		error = '';
		keyRefused = false;
		try {
			const routine = await writeRoutine(apiKey.value, model.value, description);
			if (current !== attempt) return;
			written = routine;
			step = 'review';
			scrollTo(0, 0);
		} catch (e) {
			if (current !== attempt) return;
			error = describe(e);
			keyRefused = e instanceof GroqError && e.status === 401;
			step = 'write';
		}
	}

	/** Drops the key Groq turned down, which brings back the field that asks for one. */
	function changeKey() {
		error = '';
		keyRefused = false;
		dictation.error = '';
		dictation.keyRefused = false;
		apiKey.value = '';
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

{#if step === 'review' && written}
	<EditorView draft={written} onback={() => (step = 'write')} />
{:else}
	<div class="screen">
		<header class="bar">
			<button class="back" type="button" onclick={back}>
				<Icon name="back" size={24} />
				<span>{step === 'writing' ? 'Texto' : 'Volver'}</span>
			</button>
			<h1 class="bar-title">Nueva rutina</h1>
			<div class="spacer">
				<HomeButton />
			</div>
		</header>

		{#if !apiKey.value}
			<p class="lead">
				Describe tu rutina con tus palabras, por escrito o en voz alta, y un modelo de Groq la arma con los
				ejercicios de la app. Para eso se usa tu propia API key.
			</p>
			<GroqKeyField />
		{:else if step === 'writing'}
			<div class="writing" aria-busy="true">
				<span class="spinner"></span>
				<p>Armando tu rutina…</p>
			</div>
		{:else}
			<p class="lead">
				Cuéntala con tus palabras, escrita o dictada: los días, los ejercicios, sus series y repeticiones, el
				descanso y el peso que ya mueves. Lo que no digas lo completa la IA, y la revisas antes de guardarla.
			</p>

			<div class="box" class:live={recording}>
				<textarea
					bind:value={text}
					placeholder={'Lunes: sentadilla goblet 4×10 con 24 kg, press de banca 4×8 con 60 kg y plancha 3 de 45 segundos. Miércoles: peso muerto rumano, dominadas y remo…\n\nO solo para qué es: «full body 3 días, principiante, con mancuernas».'}
					aria-label="Descripción de la rutina"
				></textarea>

				<div class="tools">
					<p class="status" class:live={recording} role="status">
						{#if dictation.phase === 'starting'}
							Abriendo el micrófono…
						{:else if recording}
							<span class="live-dot"></span> Escuchando · <span class="clock">{formatClock(dictation.seconds)}</span>
						{:else if dictation.phase === 'transcribing'}
							Transcribiendo…
						{:else}
							Toca el micrófono para dictar
						{/if}
					</p>
					{#if recording}
						<button class="text-button" type="button" onclick={() => dictation.cancel()}>Cancelar</button>
					{/if}
					<button
						class="mic"
						class:live={recording}
						type="button"
						disabled={dictation.busy}
						aria-busy={dictation.busy}
						aria-label={recording ? 'Detener y transcribir' : 'Dictar'}
						title={recording ? 'Detener y transcribir' : 'Dictar'}
						style:--level={dictation.level}
						onclick={() => dictation.toggle()}
					>
						<span class="halo" aria-hidden="true"></span>
						<span class="round">
							{#if dictation.busy}
								<span class="spinner" aria-hidden="true"></span>
							{:else if recording}
								<Icon name="stop" size={22} />
							{:else}
								<Icon name="mic" size={22} />
							{/if}
						</span>
					</button>
				</div>
			</div>

			{#if dictation.error}
				{@render failure(dictation.error, dictation.keyRefused)}
			{/if}

			<h2 class="section-title">Inteligencia artificial</h2>
			<div class="group">
				<ModelField />
				<ModelField kind="transcription" />
			</div>
			<p class="hint">
				Lo que escribes, y el audio de lo que dictas, solo se envían a api.groq.com: el modelo de voz a texto
				escribe lo que dices y el otro arma la rutina.
			</p>

			{#if error}
				{@render failure(error, keyRefused)}
			{/if}

			<button
				class="primary go"
				type="button"
				onclick={write}
				disabled={!text.trim() || dictation.phase !== 'idle'}
			>
				<Icon name="sparkles" size={18} />
				Crear rutina
			</button>
		{/if}
	</div>
{/if}

<style>
	/* As wide as the way back, so the title stays centred. */
	.spacer {
		display: flex;
		justify-content: flex-end;
		width: 64px;
	}

	.lead {
		margin: 8px 4px 16px;
		color: var(--muted);
		line-height: 1.5;
	}

	.box {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--group);
		transition: border-color 0.2s;
	}

	.box:focus-within {
		border-color: var(--accent);
	}

	.box.live {
		border-color: var(--alarm);
	}

	textarea {
		display: block;
		width: 100%;
		min-height: 200px;
		max-height: 60dvh;
		padding: 14px 16px 4px;
		border: 0;
		outline: none;
		background: none;
		font-size: 17px;
		line-height: 1.45;
		resize: none;
		/* Grows with what is written, where the browser can; elsewhere it scrolls. */
		field-sizing: content;
	}

	textarea::placeholder {
		color: var(--faint);
	}

	.tools {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 8px 8px 16px;
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

	.status.live {
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

	.mic {
		position: relative;
		flex: none;
		width: 48px;
		height: 48px;
		padding: 0;
		border: 0;
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
		color: #fff;
		transition:
			background 0.2s,
			transform 0.1s;
	}

	.mic.live .round {
		background: var(--alarm);
	}

	.mic:active:not(:disabled) .round {
		transform: scale(0.94);
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

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: inherit;
		font-weight: 600;
	}

	.go {
		margin-top: 20px;
	}

	.writing {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 64px 16px;
		color: var(--muted);
		text-align: center;
	}
</style>
