<script lang="ts">
	import { ledger, type Person } from '$lib/ledger.svelte';
	import { formatMoney } from '$lib/money';

	interface Props {
		/** Only someone who owes can be paid, and no one is created from a payment. */
		onlyDebtors?: boolean;
		onpick: (person: Person) => void;
	}

	let { onlyDebtors = false, onpick }: Props = $props();

	let query = $state('');

	const people = $derived(
		(onlyDebtors ? ledger.debtors : ledger.balances).toSorted((a, b) =>
			a.person.name.localeCompare(b.person.name, 'es')
		)
	);

	const search = $derived(query.trim().toLocaleLowerCase('es'));

	const matches = $derived(
		search ? people.filter((entry) => entry.person.name.toLocaleLowerCase('es').includes(search)) : people
	);

	/**
	 * The same field searches and creates: creating is offered only when what was typed is not
	 * already someone's name, so people are not duplicated by accident.
	 */
	const canCreate = $derived(!onlyDebtors && search !== '' && !ledger.findByName(query));

	function create() {
		onpick(ledger.addPerson(query));
	}
</script>

<div class="search">
	<input
		type="search"
		bind:value={query}
		placeholder={onlyDebtors ? 'Buscar persona' : 'Buscar o escribir un nombre nuevo'}
		autocomplete="off"
		autocapitalize="words"
		enterkeyhint={canCreate ? 'done' : 'search'}
		onkeydown={(event) => {
			if (event.key === 'Enter' && canCreate) create();
		}}
	/>
</div>

{#if canCreate}
	<div class="group">
		<button class="row create" type="button" onclick={create}>
			<span class="plus" aria-hidden="true">+</span>
			<span class="label">Agregar «{query.trim()}»</span>
		</button>
	</div>
{/if}

{#if matches.length > 0}
	<div class="group">
		{#each matches as entry (entry.person.id)}
			<button class="row person" type="button" onclick={() => onpick(entry.person)}>
				<span class="name">{entry.person.name}</span>
				{#if entry.owed > 0}
					<span class="amount owed">{formatMoney(entry.owed)}</span>
				{:else}
					<span class="amount clear">Sin adeudo</span>
				{/if}
			</button>
		{/each}
	</div>
{:else if !canCreate}
	<p class="empty">
		{#if onlyDebtors}
			{people.length === 0 ? 'Nadie te debe dinero ahora mismo.' : 'Nadie con ese nombre te debe dinero.'}
		{:else}
			Escribe un nombre para agregar a la primera persona.
		{/if}
	</p>
{/if}

<style>
	.search {
		margin-bottom: 16px;
		border-radius: 12px;
		background: var(--group);
	}

	input {
		width: 100%;
		padding: 12px 16px;
		border: 0;
		border-radius: 12px;
		background: none;
	}

	input:focus {
		outline: none;
	}

	input::-webkit-search-cancel-button {
		-webkit-appearance: none;
	}

	.row {
		width: 100%;
	}

	.row:active {
		background: var(--hover);
	}

	.create .label {
		color: var(--link);
	}

	.plus {
		display: grid;
		width: 28px;
		height: 28px;
		flex: none;
		place-items: center;
		border-radius: 50%;
		background: var(--link);
		color: #fff;
		font-size: 20px;
		line-height: 1;
	}

	.person {
		justify-content: space-between;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.owed {
		flex: none;
		color: var(--muted);
	}

	.clear {
		flex: none;
		color: var(--faint);
		font-size: 15px;
	}

	.empty {
		margin: 24px 16px;
		color: var(--muted);
		text-align: center;
	}
</style>
