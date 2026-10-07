<script lang="ts">
	// «Amigos»: who a post for some friends is for, picked from the account's favourites or found by
	// username. A tap picks someone for this post; the star keeps them among the favourites, where
	// the next post finds them without searching.
	import { isExpired, session } from '@leo-os/shared';
	import { onDestroy } from 'svelte';
	import { favorites, findPeople, type Person } from '$lib/people.svelte';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable(), selected = $bindable() }: { open: boolean; selected: Person[] } = $props();

	let query = $state('');
	let results = $state<Person[]>([]);
	/** What the results on screen were found for. */
	let searched = $state('');
	let searching = $state(false);
	let problem = $state('');

	let timer: ReturnType<typeof setTimeout> | undefined;
	/** Counts searches, so that only the last one to be asked for is shown. */
	let asked = 0;

	onDestroy(() => clearTimeout(timer));

	// From a post's own link the app's door was never opened, and nothing has read the favourites.
	$effect(() => {
		if (open && session.account) favorites.ensure(session.account.id);
	});

	function oninput() {
		clearTimeout(timer);
		timer = setTimeout(search, 250);
	}

	async function search() {
		const term = query.trim();
		const ask = ++asked;
		problem = '';
		if (!term) {
			results = [];
			searched = '';
			searching = false;
			return;
		}
		searching = true;
		try {
			const found = await findPeople(term);
			if (ask !== asked) return;
			results = found;
			searched = term;
		} catch (thrown) {
			if (ask !== asked) return;
			if (isExpired(thrown)) session.expire();
			problem = thrown instanceof Error && thrown.message ? thrown.message : 'No se pudo buscar.';
		} finally {
			if (ask === asked) searching = false;
		}
	}

	const chosen = $derived(new Set(selected.map((person) => person.id)));
	const typed = $derived(query.trim() !== '');
	const shown = $derived(typed ? results : favorites.list);

	function pick(person: Person) {
		selected = chosen.has(person.id)
			? selected.filter((friend) => friend.id !== person.id)
			: [...selected, person];
	}
</script>

<Sheet bind:open title="Amigos">
	{#snippet trailing()}
		<button class="text-button blue" type="button" onclick={() => (open = false)}>Listo</button>
	{/snippet}

	<label class="search">
		<Icon name="search" size={16} />
		<input
			bind:value={query}
			{oninput}
			onkeydown={(event) => event.key === 'Enter' && search()}
			type="search"
			placeholder="Busca por nombre de usuario"
			aria-label="Busca por nombre de usuario"
			autocapitalize="none"
			autocomplete="off"
			autocorrect="off"
			spellcheck="false"
			enterkeyhint="search"
		/>
		{#if searching}<span class="spinner small"></span>{/if}
	</label>

	{#if selected.length > 0}
		<ul class="chosen" aria-label="Elegidos">
			{#each selected as person (person.id)}
				<li>
					<button type="button" onclick={() => pick(person)} aria-label="Quitar a {person.username}">
						<span class="face">
							<Avatar src={person.avatar ?? ''} username={person.username} size={48} />
							<span class="x"><Icon name="close" size={10} stroke={3.5} /></span>
						</span>
						<span class="name">{person.username}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if typed}
		{#if problem}
			<p class="error pad">{problem}</p>
		{:else if searched && results.length === 0 && !searching}
			<p class="hint pad">Nadie tiene «{searched}» en su nombre de usuario.</p>
		{/if}
	{:else}
		<h3>Favoritos</h3>
		{#if favorites.list.length === 0}
			<p class="hint pad">
				Busca a tus amigos por su nombre de usuario y márcalos con la estrella: aparecerán aquí cada
				vez que publiques.
			</p>
		{/if}
	{/if}

	<ul class="people">
		{#each shown as person (person.id)}
			{@const starred = favorites.has(person.id)}
			<li>
				<button
					class="row"
					type="button"
					role="checkbox"
					aria-checked={chosen.has(person.id)}
					onclick={() => pick(person)}
				>
					<Avatar src={person.avatar ?? ''} username={person.username} size={44} />
					<span class="username">{person.username}</span>
					<span class="check" aria-hidden="true">
						{#if chosen.has(person.id)}<Icon name="check" size={14} stroke={3} />{/if}
					</span>
				</button>
				<!-- Beside the row, not in it: one button cannot hold another. -->
				<button
					class="star"
					class:starred
					type="button"
					aria-pressed={starred}
					aria-label={starred
						? `Quitar a ${person.username} de favoritos`
						: `Añadir a ${person.username} a favoritos`}
					onclick={() => favorites.toggle(person)}
				>
					<Icon name={starred ? 'starred' : 'star'} size={22} />
				</button>
			</li>
		{/each}
	</ul>
</Sheet>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 12px 16px 4px;
		padding: 0 12px;
		border-radius: 10px;
		background: var(--field);
		color: var(--muted);
	}

	.search input {
		flex: 1;
		min-width: 0;
		padding: 9px 0;
		border: 0;
		outline: none;
		background: none;
		color: var(--text);
		/* Under 16px iOS zooms in on the field. */
		font-size: 16px;
	}

	.spinner.small {
		width: 14px;
		height: 14px;
		border-width: 2px;
	}

	.chosen {
		display: flex;
		gap: 12px;
		margin: 0;
		padding: 12px 16px 4px;
		overflow-x: auto;
		list-style: none;
		scrollbar-width: none;
	}

	.chosen button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 60px;
		padding: 0;
		border: 0;
		background: none;
	}

	.face {
		position: relative;
	}

	.x {
		display: grid;
		position: absolute;
		top: -2px;
		right: -4px;
		place-items: center;
		width: 20px;
		height: 20px;
		border: 2px solid var(--sheet);
		border-radius: 50%;
		background: var(--muted);
		color: var(--sheet);
	}

	.name {
		max-width: 100%;
		overflow: hidden;
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	h3 {
		margin: 16px 16px 4px;
		font-size: 16px;
		font-weight: 700;
	}

	.pad {
		padding: 0 16px;
	}

	.people {
		margin: 0;
		padding: 4px 0 16px;
		list-style: none;
	}

	.people li {
		position: relative;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 60px;
		/* Room on the right for the star, which sits over the row, and for the check. */
		padding: 8px 100px 8px 16px;
		border: 0;
		background: none;
		text-align: left;
	}

	.username {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.check {
		display: grid;
		position: absolute;
		top: 50%;
		right: 16px;
		place-items: center;
		width: 24px;
		height: 24px;
		border: 2px solid var(--muted);
		border-radius: 50%;
		color: #fff;
		transform: translateY(-50%);
	}

	.row[aria-checked='true'] .check {
		border-color: var(--blue);
		background: var(--blue);
	}

	.star {
		display: grid;
		position: absolute;
		top: 50%;
		right: 52px;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--muted);
		transform: translateY(-50%);
	}

	.star.starred {
		color: #f5b301;
	}
</style>
