<script lang="ts">
	// Who a post is for, as it is written and whenever its author changes it: anybody with its link,
	// or some friends only, who open it with their account; and whether the bio lists it, which
	// shows it there to those same people — everybody, or those friends — and to nobody else.
	import { people } from '$lib/format';
	import type { Person } from '$lib/people.svelte';
	import type { Audience } from '$lib/post';
	import Avatar from './Avatar.svelte';
	import FriendsSheet from './FriendsSheet.svelte';
	import Icon from './Icon.svelte';

	let {
		audience = $bindable(),
		friends = $bindable(),
		listed = $bindable(),
		titled = true
	}: {
		audience: Audience;
		friends: Person[];
		listed: boolean;
		/** Whether «Quién la ve» shows on top; a sheet that already says it keeps it for screen readers. */
		titled?: boolean;
	} = $props();

	/** The radios' name: one per copy of this, so two never share a group. */
	const group = $props.id();

	let picking = $state(false);

	/** Some friends, and nobody picked yet: straight to picking them. */
	function forFriends() {
		if (audience === 'friends' && friends.length === 0) picking = true;
	}

	const where = $derived.by(() => {
		if (audience === 'link') {
			return listed
				? 'Aparecerá en tu bio para todos.'
				: 'No aparecerá en tu bio: solo la verá quien tenga el enlace.';
		}
		return listed
			? 'Aparecerá en tu bio solo para esos amigos.'
			: 'No aparecerá en tu bio, ni siquiera para esos amigos: la abrirán con el enlace.';
	});
</script>

<section class="visibility" aria-labelledby="{group}-title">
	<h3 id="{group}-title" class="display" class:visually-hidden={!titled}>Quién la ve</h3>

	<div class="options" role="radiogroup" aria-labelledby="{group}-title">
		<label class="option">
			<Icon name="link" size={22} />
			<span class="text">
				<strong>Cualquiera con el enlace</strong>
				<span>Quien lo abra la ve, aunque no tenga cuenta.</span>
			</span>
			<input type="radio" name={group} value="link" bind:group={audience} />
		</label>
		<label class="option">
			<Icon name="friends" size={22} />
			<span class="text">
				<strong>Amigos específicos</strong>
				<span>Solo quienes elijas, entrando con su cuenta.</span>
			</span>
			<input type="radio" name={group} value="friends" bind:group={audience} onchange={forFriends} />
		</label>
	</div>

	{#if audience === 'friends'}
		<button class="friends" type="button" onclick={() => (picking = true)}>
			{#if friends.length > 0}
				<span class="faces" aria-hidden="true">
					{#each friends.slice(0, 3) as friend (friend.id)}
						<Avatar src={friend.avatar ?? ''} username={friend.username} size={26} />
					{/each}
				</span>
				<span class="names">{people(friends.map((friend) => friend.username))}</span>
				<span class="change">Cambiar</span>
			{:else}
				<span class="names missing">Elige al menos a un amigo</span>
				<span class="change">Elegir</span>
			{/if}
			<Icon name="forward" size={18} />
		</button>
	{/if}

	<label class="option bio">
		<Icon name="grid" size={22} />
		<span class="text">
			<strong>Listar en mi bio</strong>
			<span>{where}</span>
		</span>
		<input type="checkbox" role="switch" bind:checked={listed} />
	</label>
</section>

<FriendsSheet bind:open={picking} bind:selected={friends} />

<style>
	.visibility {
		/* The composer's sides; a sheet passes its own, `--side`. */
		--pad: var(--side, 12px);
		border-bottom: var(--line) solid var(--ink);
	}

	h3 {
		margin: 0;
		padding: 16px var(--pad) 4px;
		font-size: 22px;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px var(--pad);
		cursor: pointer;
	}

	.text {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.text strong {
		font-size: 16px;
		font-weight: 800;
	}

	.text span {
		color: var(--muted);
		font-size: 13px;
		line-height: 17px;
	}

	.bio {
		border-top: var(--line) solid var(--ink);
	}

	/* An outlined ring, inked in the middle once chosen. */
	input[type='radio'] {
		flex: none;
		width: 26px;
		height: 26px;
		margin: 0;
		border: var(--line) solid var(--ink);
		border-radius: 50%;
		background: var(--card);
		appearance: none;
		cursor: pointer;
		transition: box-shadow 0.15s;
	}

	input[type='radio']:checked {
		background: var(--accent);
		box-shadow: inset 0 0 0 4px var(--card);
	}

	/* A switch drawn by hand, as the rest is: a browser has none of its own. Lime once on. */
	input[role='switch'] {
		position: relative;
		flex: none;
		width: 54px;
		height: 32px;
		margin: 0;
		border: var(--line) solid var(--ink);
		border-radius: 16px;
		background: var(--card);
		appearance: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	input[role='switch']::before {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 23px;
		height: 23px;
		border: 2px solid var(--ink);
		border-radius: 50%;
		background: var(--lilac);
		content: '';
		transition: transform 0.2s;
	}

	input[role='switch']:checked {
		background: var(--lime);
	}

	input[role='switch']:checked::before {
		transform: translateX(22px);
	}

	.friends {
		display: flex;
		align-items: center;
		gap: 10px;
		width: calc(100% - 2 * var(--pad) - 34px);
		margin: 0 var(--pad) 10px calc(var(--pad) + 34px);
		padding: 8px 4px 8px 12px;
		border: var(--line) solid var(--ink);
		border-radius: 12px;
		background: var(--card);
		box-shadow: 3px 3px 0 var(--ink);
		text-align: left;
	}

	.faces {
		display: flex;
		flex: none;
	}

	/* Overlapping, as Instagram shows a few faces together. */
	.faces > :global(*:not(:first-child)) {
		margin-left: -8px;
		box-shadow: 0 0 0 2px var(--card);
	}

	.names {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-weight: 800;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.names.missing {
		color: var(--danger);
	}

	.change {
		color: var(--muted);
	}
</style>
