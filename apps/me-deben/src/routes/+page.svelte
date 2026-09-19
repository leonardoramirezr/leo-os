<script lang="ts">
	import MovementSheet from '$lib/components/MovementSheet.svelte';
	import PersonSheet from '$lib/components/PersonSheet.svelte';
	import { ledger, type Person } from '$lib/ledger.svelte';
	import { formatMoney } from '$lib/money';

	let lending = $state(false);
	let collecting = $state(false);
	let selected = $state<Person | null>(null);
	let personOpen = $state(false);

	function openPerson(person: Person) {
		selected = person;
		personOpen = true;
	}
</script>

<div class="screen">
	<header>
		<h1>Me deben en total</h1>
		<p class="amount total">{formatMoney(ledger.total)}</p>
		<p class="caption">
			{#if ledger.debtors.length === 0}
				Nadie te debe dinero
			{:else if ledger.debtors.length === 1}
				1 persona te debe
			{:else}
				{ledger.debtors.length} personas te deben
			{/if}
		</p>

		{#if ledger.debtors.length > 0}
			<p class="overdue-total" class:late={ledger.totalOverdue > 0}>
				{#if ledger.totalOverdue > 0}
					<span class="dot" aria-hidden="true"></span>
					Ya venció <strong class="amount">{formatMoney(ledger.totalOverdue)}</strong>
				{:else}
					Nada vencido: todos al corriente
				{/if}
			</p>
		{/if}
	</header>

	<main>
		{#if ledger.debtors.length > 0}
			<div class="group">
				{#each ledger.debtors as entry (entry.person.id)}
					<button class="row person" type="button" onclick={() => openPerson(entry.person)}>
						<span class="detail">
							<span class="name">{entry.person.name}</span>
							{#if entry.overdue > 0}
								<span class="meta late">
									Vencido: <span class="amount">{formatMoney(entry.overdue)}</span>
								</span>
							{:else}
								<span class="meta">Al corriente</span>
							{/if}
						</span>
						<span class="amount owed">{formatMoney(entry.owed)}</span>
						<span class="chevron" aria-hidden="true">›</span>
					</button>
				{/each}
			</div>
		{:else}
			<div class="empty">
				<p class="empty-title">Sin deudas pendientes</p>
				<p class="empty-text">
					Toca <strong>+</strong> para registrar a quien le prestaste dinero.
				</p>
			</div>
		{/if}

		{#if ledger.settled.length > 0}
			<p class="section-title">Sin adeudo</p>
			<div class="group">
				{#each ledger.settled as entry (entry.person.id)}
					<button class="row person" type="button" onclick={() => openPerson(entry.person)}>
						<span class="detail">
							<span class="name">{entry.person.name}</span>
						</span>
						<span class="amount settled">
							{entry.owed < 0 ? `${formatMoney(-entry.owed)} de más` : 'Al corriente'}
						</span>
						<span class="chevron" aria-hidden="true">›</span>
					</button>
				{/each}
			</div>
		{/if}
	</main>

	<nav class="bar" aria-label="Acciones">
		<button
			class="circle minus"
			type="button"
			disabled={ledger.debtors.length === 0}
			onclick={() => (collecting = true)}
		>
			<span class="sign" aria-hidden="true">−</span>
			<span class="text">Me pagaron</span>
		</button>
		<button class="circle plus" type="button" onclick={() => (lending = true)}>
			<span class="sign" aria-hidden="true">+</span>
			<span class="text">Presté</span>
		</button>
	</nav>
</div>

<MovementSheet bind:open={lending} kind="loan" />
<MovementSheet bind:open={collecting} kind="payment" />

{#if selected}
	<PersonSheet bind:open={personOpen} person={selected} />
{/if}

<style>
	.screen {
		max-width: 560px;
		/* Room so the bottom bar does not cover the last row. */
		padding: 0 16px calc(120px + env(safe-area-inset-bottom));
		margin: 0 auto;
	}

	header {
		padding: calc(24px + env(safe-area-inset-top)) 4px 24px;
	}

	h1 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		color: var(--muted);
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.total {
		margin: 8px 0 2px;
		font-size: 42px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.caption {
		margin: 0;
		color: var(--muted);
		font-size: 15px;
	}

	.overdue-total {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 12px 0 0;
		color: var(--muted);
		font-size: 15px;
	}

	.overdue-total.late {
		color: var(--danger);
	}

	.overdue-total strong {
		font-weight: 600;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--danger);
	}

	.person {
		width: 100%;
		gap: 10px;
	}

	.person:active {
		background: var(--hover);
	}

	.detail {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 2px;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		color: var(--muted);
		font-size: 13px;
	}

	.meta.late {
		color: var(--danger);
	}

	.owed {
		flex: none;
		font-weight: 600;
	}

	.settled {
		flex: none;
		color: var(--muted);
		font-size: 15px;
	}

	.chevron {
		flex: none;
		color: var(--faint);
		font-size: 20px;
		line-height: 1;
	}

	.empty {
		padding: 48px 24px;
		text-align: center;
	}

	.empty-title {
		margin: 0 0 8px;
		font-size: 17px;
		font-weight: 600;
	}

	.empty-text {
		margin: 0;
		color: var(--muted);
	}

	/* Fixed bar: minus on the left to collect, plus on the right to lend. */
	.bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: center;
		gap: 40px;
		padding: 12px 16px calc(16px + env(safe-area-inset-bottom));
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
		border-top: 1px solid var(--border);
	}

	.circle {
		display: flex;
		width: 88px;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		border: 0;
		background: none;
		padding: 0;
	}

	.sign {
		display: grid;
		width: 60px;
		height: 60px;
		place-items: center;
		border-radius: 50%;
		color: #fff;
		font-size: 34px;
		font-weight: 300;
		line-height: 1;
		box-shadow: var(--shadow);
	}

	.minus .sign {
		background: var(--in);
	}

	.plus .sign {
		background: var(--out);
	}

	.circle:active .sign {
		transform: scale(0.94);
	}

	.circle:disabled {
		opacity: 0.35;
	}

	.text {
		color: var(--muted);
		font-size: 13px;
	}
</style>
