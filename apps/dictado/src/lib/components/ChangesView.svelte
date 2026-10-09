<script lang="ts">
	import { HomeButton } from '@leo-os/shared';
	import { compare, type Segment } from '$lib/diff';
	import { draft } from '$lib/draft.svelte';
	import Icon from './Icon.svelte';

	/** How the text is drawn: plain, or marked as taken out or put in. */
	interface Piece {
		kind: 'plain' | 'removed' | 'added';
		text: string;
		/** A line break taken out or put in, which on its own would show as nothing at all. */
		mark?: boolean;
	}

	const comparison = $derived(draft.comparison);
	const changes = $derived(comparison && compare(comparison.before, comparison.after));
	const pieces = $derived(changes ? piecesOf(changes.segments) : []);

	const summary = $derived.by(() => {
		if (!comparison || !changes) return '';

		const { removed, added } = changes;
		// What Editar was told comes as Whisper wrote it down, often with a period that does not go
		// before «quitó».
		const by = `«${comparison.by.replace(/\.+$/, '')}»`;
		let said: string;
		if (removed && added) said = `${by} quitó ${plural(removed)} y añadió ${added}.`;
		else if (removed) said = `${by} quitó ${plural(removed)}.`;
		else if (added) said = `${by} añadió ${plural(added)}.`;
		else said = `${by} no quitó ni añadió palabras.`;
		return comparison.edited ? `${said} Incluye también lo que dictaste o escribiste después.` : said;
	});

	function plural(count: number): string {
		return `${count} ${count === 1 ? 'palabra' : 'palabras'}`;
	}

	/**
	 * A change is marked line by line, with the line breaks and the whitespace around it plain: only
	 * words are marked, and an empty line between two paragraphs is not drawn as a sliver of colour.
	 * A change that is nothing but a line break gets a mark of its own.
	 */
	function piecesOf(segments: Segment[]): Piece[] {
		const pieces: Piece[] = [];
		for (const { kind, text } of segments) {
			if (kind === 'same') {
				pieces.push({ kind: 'plain', text });
			} else if (text.trim()) {
				text.split(/(\s*\n\s*)/).forEach((part, i) => {
					// Odd parts are the line breaks between the lines of the change.
					if (i % 2) return pieces.push({ kind: 'plain', text: part });

					const lead = /^\s*/.exec(part)?.[0] ?? '';
					const core = part.trim();
					const trail = part.slice(lead.length + core.length);
					pieces.push({ kind: 'plain', text: lead }, { kind, text: core }, { kind: 'plain', text: trail });
				});
			} else if (text.includes('\n')) {
				pieces.push({ kind, text: '¶', mark: true });
				// A break put in is there now; one taken out is not.
				if (kind === 'added') pieces.push({ kind: 'plain', text });
			} else if (kind === 'added') {
				pieces.push({ kind: 'plain', text });
			}
		}
		return pieces.filter((piece) => piece.text);
	}
</script>

<div class="screen">
	<header class="bar">
		<div class="side">
			<button class="icon-button" type="button" onclick={() => history.back()} aria-label="Volver al texto" title="Volver al texto">
				<Icon name="back" size={26} />
			</button>
		</div>
		<h1>Cambios</h1>
		<div class="side end">
			<HomeButton />
		</div>
	</header>

	{#if comparison && changes}
		<p class="summary">{summary}</p>
		<p class="legend" aria-hidden="true">
			<span class="key removed">Quitado</span>
			<span class="key added">Añadido</span>
		</p>

		<!-- On one line: inside the paragraph every space and line break is part of the text. -->
		<div class="page">
			<p class="diff">{#each pieces as piece, i (i)}{#if piece.kind === 'removed'}<del class:mark={piece.mark} title={piece.mark ? 'Salto de línea quitado' : undefined}>{piece.text}</del>{:else if piece.kind === 'added'}<ins class:mark={piece.mark} title={piece.mark ? 'Salto de línea añadido' : undefined}>{piece.text}</ins>{:else}{piece.text}{/if}{/each}</p>
		</div>
	{:else}
		<div class="empty">
			<p class="empty-title">No hay cambios que mostrar</p>
			<p class="empty-text">
				Mejora el texto o cámbialo con «Editar» y aquí verás lo que se quitó, en rojo, y lo que se
				añadió, en verde.
			</p>
		</div>
	{/if}
</div>

<style>
	.screen {
		max-width: 760px;
		margin: 0 auto;
		padding: 0 max(12px, env(safe-area-inset-right)) calc(32px + env(safe-area-inset-bottom))
			max(12px, env(safe-area-inset-left));
	}

	/* It stays at the top while a long text scrolls under it. */
	.bar {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 -2px;
		padding: calc(env(safe-area-inset-top) + 6px) 0 6px;
		background: var(--bg);
	}

	.side {
		display: flex;
		flex: 1 1 0;
	}

	.side.end {
		justify-content: flex-end;
	}

	h1 {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
	}

	.summary {
		margin: 6px 6px 0;
		color: var(--muted);
		font-size: 15px;
		line-height: 1.45;
	}

	.legend {
		display: flex;
		gap: 8px;
		margin: 10px 6px 12px;
	}

	.key {
		padding: 2px 8px;
		border-radius: 6px;
		font-size: 13px;
		font-weight: 600;
	}

	.key.removed {
		background: var(--removed-bg);
		color: var(--removed);
		text-decoration: line-through;
	}

	.key.added {
		background: var(--added-bg);
		color: var(--added);
	}

	.page {
		border-radius: 20px;
		background: var(--group);
		box-shadow: var(--shadow);
	}

	.diff {
		margin: 0;
		padding: 18px 18px 24px;
		font-size: 17px;
		line-height: 1.7;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	del,
	ins {
		padding: 0.08em 0.18em;
		border-radius: 0.3em;
		-webkit-box-decoration-break: clone;
		box-decoration-break: clone;
	}

	del {
		background: var(--removed-bg);
		color: var(--removed);
		text-decoration: line-through;
	}

	ins {
		background: var(--added-bg);
		color: var(--added);
		text-decoration: none;
	}

	/* Back to back, a word taken out and the one put in its place need a little air between them. */
	del + ins {
		margin-left: 0.15em;
	}

	.mark {
		font-weight: 700;
		text-decoration: none;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 64px 24px;
		text-align: center;
	}

	.empty-title {
		margin: 0 0 6px;
		font-size: 20px;
		font-weight: 600;
	}

	.empty-text {
		max-width: 320px;
		margin: 0;
		color: var(--muted);
		font-size: 15px;
		line-height: 1.45;
	}
</style>
