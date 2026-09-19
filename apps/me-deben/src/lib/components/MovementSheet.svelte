<script lang="ts">
	import { untrack } from 'svelte';
	import { ledger, type Movement, type MovementKind, type Person } from '$lib/ledger.svelte';
	import { formatDateShort, formatMoney, parseMoney, toAmountInput, today } from '$lib/money';
	import { chargeCount, chargeDate, perLabel, plans, type Plan } from '$lib/plan';
	import BankSelect from './BankSelect.svelte';
	import PersonPicker from './PersonPicker.svelte';
	import Sheet from './Sheet.svelte';

	interface Props {
		open: boolean;
		kind: MovementKind;
		/** Si se abre desde una persona, ya se sabe de quién se trata y se salta elegirla. */
		person?: Person | null;
		/**
		 * Un movimiento ya capturado: la hoja lo corrige en vez de registrar uno nuevo. Se edita
		 * desde la hoja de la persona, así que llega junto con su `person`.
		 */
		movement?: Movement | null;
	}

	let { open = $bindable(), kind, person = null, movement = null }: Props = $props();

	let selected = $state<Person | null>(null);
	let amount = $state('');
	let date = $state(today());
	let dueDate = $state('');
	let plan = $state<Plan>('');
	let planAmount = $state('');
	let planStart = $state('');
	let fromBank = $state('');
	let toBank = $state('');
	let note = $state('');

	const loan = $derived(kind === 'loan');

	const title = $derived.by(() => {
		if (movement) return loan ? 'Editar préstamo' : 'Editar pago';
		return loan ? 'Nuevo préstamo' : 'Registrar pago';
	});

	const saveLabel = $derived.by(() => {
		if (movement) return 'Guardar cambios';
		return loan ? 'Guardar préstamo' : 'Guardar pago';
	});

	const cents = $derived(parseMoney(amount));

	/** Lo que debe sin contar este movimiento: al editar, el saldo guardado ya lo incluye. */
	const owed = $derived.by(() => {
		if (!selected) return 0;

		const balance = ledger.owedBy(selected.id);
		if (!movement) return balance;
		return balance + (movement.kind === 'loan' ? -movement.amount : movement.amount);
	});

	const remaining = $derived(owed - (cents ?? 0));
	// Un préstamo viejo se captura con las dos fechas en el pasado: ninguna se limita.
	// Devolver antes de prestar sí es raro, pero solo se avisa; guardar nunca se bloquea por eso.
	const badDueDate = $derived(loan && plan === '' && dueDate !== '' && dueDate < date);

	const planCents = $derived(parseMoney(planAmount));

	/** Los cobros que saldrían del acuerdo, para explicarlo antes de guardar. */
	const schedule = $derived.by(() => {
		if (!loan || plan === '' || cents === null || planCents === null || planStart === '') {
			return null;
		}

		const count = chargeCount(cents, planCents);
		return {
			count,
			each: planCents,
			// El último cobro es lo que sobra del préstamo, así que puede ser menor.
			last: cents - (count - 1) * planCents,
			end: chargeDate(planStart, plan, count - 1)
		};
	});

	// Un acuerdo a medio capturar no se puede guardar: le falta el monto o el primer cobro.
	const complete = $derived(cents !== null && date !== '' && (plan === '' || schedule !== null));

	// Cada vez que se abre la hoja se parte de cero, o de lo que trae el movimiento que se corrige.
	$effect(() => {
		if (open) untrack(reset);
	});

	function reset() {
		if (movement) load(movement);
		else blank();
	}

	function blank() {
		selected = person;
		amount = person && !loan ? toAmountInput(ledger.owedBy(person.id)) : '';
		date = today();
		dueDate = '';
		plan = '';
		planAmount = '';
		planStart = '';
		// Mi cuenta de siempre viene precargada; la de la otra persona cambia en cada préstamo.
		fromBank = loan ? ledger.myBank : '';
		toBank = loan ? '' : ledger.myBank;
		note = '';
	}

	/** Un movimiento capturado se edita con sus propios datos, no con los de siempre. */
	function load(existing: Movement) {
		selected = person;
		amount = toAmountInput(existing.amount);
		date = existing.date;
		dueDate = existing.dueDate;
		plan = existing.plan;
		planAmount = existing.plan === '' ? '' : toAmountInput(existing.planAmount);
		planStart = existing.planStart;
		fromBank = existing.fromBank;
		toBank = existing.toBank;
		note = existing.note;
	}

	function pick(picked: Person) {
		selected = picked;
		// Lo normal es que paguen todo lo que deben: se propone ese monto y se puede editar.
		if (!loan) amount = toAmountInput(ledger.owedBy(picked.id));
	}

	function save() {
		if (!selected || !complete || cents === null) return;

		const fields = {
			amount: cents,
			date,
			// El acuerdo de pago sustituye a la fecha de devolución: nunca se guardan los dos.
			dueDate: loan && plan === '' ? dueDate : '',
			plan: loan ? plan : '',
			planAmount: loan && plan !== '' ? (planCents ?? 0) : 0,
			planStart: loan && plan !== '' ? planStart : '',
			fromBank,
			toBank,
			note: note.trim()
		};

		if (movement) ledger.updateMovement(movement.id, fields);
		else ledger.addMovement({ personId: selected.id, kind, ...fields });

		// Mi banco casi nunca cambia: se recuerda como valor por omisión del siguiente movimiento.
		const mine = loan ? fromBank : toBank;
		if (mine) ledger.myBank = mine;

		open = false;
	}
</script>

<Sheet bind:open {title}>
	{#snippet leading()}
		{#if selected && !person}
			<button class="plain" type="button" onclick={() => (selected = null)}>Atrás</button>
		{:else}
			<button class="plain" type="button" onclick={() => (open = false)}>Cancelar</button>
		{/if}
	{/snippet}

	{#if !selected}
		<PersonPicker onlyDebtors={!loan} onpick={pick} />
	{:else}
		<p class="who">
			{loan ? 'Le presté a' : 'Me pagó'}
			<strong>{selected.name}</strong>
		</p>

		<div class="group">
			<label class="row">
				<span class="label">Monto</span>
				<input
					type="text"
					inputmode="decimal"
					bind:value={amount}
					placeholder="0.00"
					autocomplete="off"
					enterkeyhint="done"
				/>
			</label>
			<label class="row">
				<span class="label">{loan ? 'Se prestó' : 'Fecha'}</span>
				<input type="date" bind:value={date} max={today()} />
			</label>
			{#if loan}
				<label class="row">
					<span class="label">Acuerdo de pago</span>
					<select bind:value={plan}>
						<option value="">Sin acuerdo</option>
						{#each plans as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</label>
				<!-- Con acuerdo de pago no hay una sola devolución, sino cobros: el campo sobra. -->
				{#if plan === ''}
					<label class="row">
						<span class="label">Se devuelve</span>
						<input type="date" bind:value={dueDate} />
					</label>
				{:else}
					<label class="row">
						<span class="label">Monto {perLabel(plan)}</span>
						<input
							type="text"
							inputmode="decimal"
							bind:value={planAmount}
							placeholder="0.00"
							autocomplete="off"
							enterkeyhint="done"
						/>
					</label>
					<label class="row">
						<span class="label">Primer cobro</span>
						<input type="date" bind:value={planStart} />
					</label>
				{/if}
			{/if}
		</div>

		{#if loan}
			<p class="hint" class:warn={badDueDate}>
				{#if plan !== ''}
					{#if schedule === null}
						Se cobra {perLabel(plan)} a partir del primer cobro.
					{:else if schedule.count === 1}
						Un solo cobro de {formatMoney(schedule.last)} el {formatDateShort(planStart)}.
					{:else if schedule.last === schedule.each}
						{schedule.count} cobros de {formatMoney(schedule.each)}, del {formatDateShort(planStart)}
						al {formatDateShort(schedule.end)}.
					{:else}
						{schedule.count} cobros, del {formatDateShort(planStart)} al {formatDateShort(
							schedule.end
						)}: el último es de {formatMoney(schedule.last)}.
					{/if}
				{:else if badDueDate}
					La devolución quedó antes del préstamo: revisa las fechas.
				{:else if dueDate === ''}
					Sin fecha de devolución el préstamo nunca se marca como vencido.
				{/if}
			</p>
		{/if}

		{#if !loan && owed > 0}
			<p class="hint">
				Te debe {formatMoney(owed)}.
				{#if cents !== null}
					{#if remaining > 0}
						Quedará debiendo {formatMoney(remaining)}.
					{:else if remaining === 0}
						Queda al corriente.
					{:else}
						Te pagó {formatMoney(-remaining)} de más.
					{/if}
				{/if}
			</p>
		{/if}

		<p class="section-title">Cuentas</p>
		<div class="group">
			<BankSelect label={loan ? 'Desde mi cuenta' : 'Desde su cuenta'} bind:value={fromBank} />
			<BankSelect label={loan ? 'A su cuenta' : 'A mi cuenta'} bind:value={toBank} />
		</div>

		<div class="group">
			<label class="row">
				<span class="label">Nota</span>
				<input type="text" bind:value={note} placeholder="Opcional" autocomplete="off" />
			</label>
		</div>

		<div class="save">
			<button class="primary" type="button" disabled={!complete} onclick={save}>
				{saveLabel}
			</button>
		</div>
	{/if}
</Sheet>

<style>
	.plain {
		padding: 4px 0;
		border: 0;
		background: none;
		color: var(--link);
		font-size: 17px;
	}

	.who {
		margin: 0 4px 16px;
		color: var(--muted);
	}

	.who strong {
		color: var(--text);
		font-weight: 600;
	}

	.hint {
		margin: 8px 4px 0;
		min-height: 20px;
		color: var(--muted);
		font-size: 14px;
	}

	.hint.warn {
		color: var(--danger);
	}

	select {
		color: var(--link);
	}

	/* El menú desplegable se lee mejor alineado a la izquierda que el valor de la fila. */
	option {
		text-align: left;
	}

	.save {
		margin-top: 24px;
	}
</style>
