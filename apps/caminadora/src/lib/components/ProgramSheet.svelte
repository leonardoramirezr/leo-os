<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { length, plural } from '$lib/format';
	import { lengthOf, MAX_SPEED, programs, type Program, type Segment } from '$lib/programs.svelte';
	import Icon from './Icon.svelte';
	import Profile from './Profile.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		/** A program already there: the sheet changes or deletes it instead of creating one. */
		program?: Program;
	}

	let { open = $bindable(), program }: Props = $props();

	/** A segment as it is typed: text, until it adds up to one. */
	interface Row {
		key: number;
		minutes: string;
		seconds: string;
		speed: string;
	}

	let name = $state('');
	let rows = $state<Row[]>([]);
	/** Set by trying to save: from then on every field that does not add up says so. */
	let checked = $state(false);
	let nameField = $state<HTMLInputElement>();
	let list = $state<HTMLOListElement>();
	let keys = 0;

	function rowOf(segment?: Segment): Row {
		if (!segment) return { key: keys++, minutes: '', seconds: '', speed: '' };
		return {
			key: keys++,
			minutes: String(Math.floor(segment.seconds / 60)),
			seconds: String(segment.seconds % 60).padStart(2, '0'),
			speed: String(segment.speed)
		};
	}

	/** Whole minutes or seconds, none when left empty; undefined when it is not a number. */
	function whole(text: string): number | undefined {
		const typed = text.trim();
		if (!typed) return 0;
		return /^\d{1,4}$/.test(typed) ? Number(typed) : undefined;
	}

	/** Km/h, to one decimal, written with a point or a comma. */
	function speedOf(text: string): number | undefined {
		const typed = text.trim().replace(',', '.');
		if (!/^\d*\.?\d*$/.test(typed) || !/\d/.test(typed)) return undefined;
		const value = Math.round(Number(typed) * 10) / 10;
		return value > 0 && value <= MAX_SPEED ? value : undefined;
	}

	function secondsOf(row: Row): number | undefined {
		const minutes = whole(row.minutes);
		const seconds = whole(row.seconds);
		return minutes === undefined || seconds === undefined ? undefined : minutes * 60 + seconds;
	}

	function segmentOf(row: Row): Segment | undefined {
		const seconds = secondsOf(row);
		const speed = speedOf(row.speed);
		return seconds && speed ? { seconds, speed } : undefined;
	}

	const segments = $derived(rows.map(segmentOf).filter((segment) => segment !== undefined));
	const complete = $derived(rows.length > 0 && segments.length === rows.length);

	/** Whether a row's time should say it does not add up: not a number, or once saving, no time. */
	function wrongTime(row: Row): boolean {
		const seconds = secondsOf(row);
		return seconds === undefined || (checked && seconds === 0);
	}

	function wrongSpeed(row: Row): boolean {
		return (checked || row.speed.trim() !== '') && speedOf(row.speed) === undefined;
	}

	// Every time the sheet opens it starts from the program being changed, or from one empty segment.
	$effect(() => {
		if (!open) return;

		const creating = untrack(() => {
			name = program?.name ?? '';
			rows = program ? program.segments.map((segment) => rowOf(segment)) : [rowOf()];
			checked = false;
			return !program;
		});
		if (creating) tick().then(() => nameField?.focus());
	});

	/** A new segment starts as a copy of the last one: most programs repeat more than they change. */
	function add() {
		const last = rows.at(-1);
		rows.push(last ? { ...last, key: keys++ } : rowOf());
		tick().then(() => list?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
	}

	/** Left behind, a time is written the way the treadmill shows it: 90 seconds are 1:30. */
	function tidyTime(row: Row) {
		const seconds = secondsOf(row);
		if (seconds === undefined || (!row.minutes.trim() && !row.seconds.trim())) return;
		row.minutes = String(Math.floor(seconds / 60));
		row.seconds = String(seconds % 60).padStart(2, '0');
	}

	function tidySpeed(row: Row) {
		const speed = speedOf(row.speed);
		if (speed !== undefined) row.speed = String(speed);
	}

	/** Tapping a number selects it, so that typing replaces it. */
	function select(event: FocusEvent) {
		const input = event.currentTarget as HTMLInputElement;
		// Safari would undo a selection made during the focus itself.
		setTimeout(() => input.select());
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!complete) {
			checked = true;
			// The first one marked, which in a long program may be well out of sight.
			tick().then(() =>
				list
					?.querySelector('[aria-invalid="true"]')
					?.scrollIntoView({ block: 'center', behavior: 'smooth' })
			);
			return;
		}

		open = false;
		if (program) programs.update(program.id, name, segments);
		else programs.add(name, segments);
	}

	function remove() {
		if (!program || !confirm(`¿Eliminar «${program.name}»?`)) return;

		open = false;
		programs.remove(program.id);
	}

	/** Enter in the name goes on to the first segment rather than saving half a program. */
	function onNameKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		list?.querySelector('input')?.focus();
	}
</script>

<Sheet bind:open title={program ? 'Editar programa' : 'Nuevo programa'}>
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}

	<form onsubmit={save} novalidate>
		<div class="preview" aria-hidden="true">
			{#if segments.length}
				<div class="bars"><Profile {segments} /></div>
				<p class="total">
					{length(lengthOf(segments))} · {plural(segments.length, 'segmento', 'segmentos')}
				</p>
			{:else}
				<p class="placeholder">Aquí se dibuja el programa mientras lo escribes.</p>
			{/if}
		</div>

		<div class="group">
			<label class="field">
				<span>Nombre</span>
				<input
					bind:this={nameField}
					bind:value={name}
					placeholder={program?.name ?? programs.nextName()}
					autocapitalize="sentences"
					autocomplete="off"
					enterkeyhint="next"
					onkeydown={onNameKeydown}
				/>
			</label>
		</div>

		<h3 class="section-title">Segmentos</h3>
		<div class="group segments">
			<div class="columns" aria-hidden="true">
				<span></span>
				<span>Min</span>
				<span></span>
				<span>Seg</span>
				<span>km/h</span>
			</div>
			<ol class="rows" bind:this={list}>
				{#each rows as row, index (row.key)}
					<li class="row">
						<span class="number">{index + 1}</span>
						<input
							bind:value={row.minutes}
							inputmode="numeric"
							maxlength="4"
							placeholder="0"
							autocomplete="off"
							aria-label="Minutos del segmento {index + 1}"
							aria-invalid={wrongTime(row)}
							onfocus={select}
							onblur={() => tidyTime(row)}
						/>
						<span class="colon">:</span>
						<input
							bind:value={row.seconds}
							inputmode="numeric"
							maxlength="4"
							placeholder="00"
							autocomplete="off"
							aria-label="Segundos del segmento {index + 1}"
							aria-invalid={wrongTime(row)}
							onfocus={select}
							onblur={() => tidyTime(row)}
						/>
						<input
							bind:value={row.speed}
							inputmode="decimal"
							maxlength="5"
							placeholder="0.0"
							autocomplete="off"
							aria-label="Velocidad del segmento {index + 1}, en km/h"
							aria-invalid={wrongSpeed(row)}
							onfocus={select}
							onblur={() => tidySpeed(row)}
						/>
						<button
							class="remove"
							type="button"
							onclick={() => rows.splice(index, 1)}
							disabled={rows.length === 1}
							aria-label="Quitar el segmento {index + 1}"
							title="Quitar"
						>
							<Icon name="minus" size={18} stroke={2.4} />
						</button>
					</li>
				{/each}
			</ol>
			<button class="add" type="button" onclick={add}>
				<Icon name="plus" size={18} />
				Añadir segmento
			</button>
		</div>
		<p class="hint">
			Los segmentos van uno tras otro, en este orden. Al empezar cada uno, la app te dice en voz alta su
			velocidad.
		</p>

		{#if checked && !complete}
			<p class="error" role="alert">
				Revisa los segmentos marcados: cada uno necesita un tiempo de al menos un segundo y una
				velocidad de 0.1 a {MAX_SPEED} km/h.
			</p>
		{/if}

		<button class="primary" type="submit">{program ? 'Guardar' : 'Crear programa'}</button>
	</form>

	{#if program}
		<button class="destructive" type="button" onclick={remove}>Eliminar programa</button>
	{/if}
</Sheet>

<style>
	.preview {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: 104px;
		margin-bottom: 16px;
		padding: 14px 16px 10px;
		border-radius: 14px;
		background: var(--group);
	}

	.bars {
		height: 58px;
		color: var(--text);
	}

	.total {
		margin: 8px 0 0;
		color: var(--muted);
		font-size: 13px;
		text-align: center;
	}

	.placeholder {
		margin: 0;
		color: var(--faint);
		font-size: 14px;
		text-align: center;
	}

	.segments {
		/* The number, minutes, the colon, seconds, speed, and the way out. */
		--columns: 22px 60px 8px 60px 72px 1fr;
	}

	.columns,
	.row {
		display: grid;
		grid-template-columns: var(--columns);
		align-items: center;
		gap: 6px;
		padding: 0 10px 0 12px;
	}

	.columns {
		padding-top: 10px;
		color: var(--muted);
		font-size: 12px;
		letter-spacing: 0.04em;
		text-align: center;
		text-transform: uppercase;
	}

	.columns span:nth-child(5) {
		text-transform: none;
	}

	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		padding-top: 6px;
		padding-bottom: 6px;
	}

	.row + .row {
		border-top: 1px solid var(--border);
	}

	.number {
		color: var(--muted);
		font-size: 15px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.row input {
		width: 100%;
		min-width: 0;
		height: 42px;
		padding: 0 6px;
		border: 0;
		border-radius: 10px;
		outline: none;
		background: var(--bg);
		font-size: 17px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.row input::placeholder {
		color: var(--faint);
	}

	.row input:focus {
		box-shadow: inset 0 0 0 2px var(--accent);
	}

	/* Not while it is being typed in: half a number is not a mistake yet. */
	.row input[aria-invalid='true']:not(:focus) {
		box-shadow: inset 0 0 0 2px var(--danger);
		color: var(--danger);
	}

	.colon {
		font-size: 17px;
		font-weight: 600;
		text-align: center;
	}

	.remove {
		display: grid;
		justify-self: end;
		place-items: center;
		width: 34px;
		height: 34px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--danger);
	}

	.remove:disabled {
		opacity: 0.25;
	}

	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		width: 100%;
		padding: 13px;
		border: 0;
		border-top: 1px solid var(--border);
		background: none;
		font-size: 16px;
		font-weight: 600;
	}

	.primary {
		margin-top: 16px;
	}
</style>
