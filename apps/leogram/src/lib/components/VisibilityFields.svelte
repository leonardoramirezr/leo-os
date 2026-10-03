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
	<h3 id="{group}-title" class:visually-hidden={!titled}>Quién la ve</h3>

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
		/* The composer's sides and colour; a sheet passes its own, `--side` and `--behind`. */
		--pad: var(--side, 12px);
		border-bottom: 1px solid var(--border);
	}

	h3 {
		margin: 0;
		padding: 14px var(--pad) 4px;
		font-size: 16px;
		font-weight: 700;
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
		font-size: 15px;
		font-weight: 600;
	}

	.text span {
		color: var(--muted);
		font-size: 13px;
		line-height: 17px;
	}

	.bio {
		border-top: 1px solid var(--border);
	}

	/* Instagram's: a ring that fills in thick once chosen. */
	input[type='radio'] {
		flex: none;
		width: 24px;
		height: 24px;
		margin: 0;
		border: 2px solid var(--muted);
		border-radius: 50%;
		appearance: none;
		cursor: pointer;
		transition: border-width 0.15s;
	}

	input[type='radio']:checked {
		border: 7px solid var(--text);
	}

	/* iOS's switch, drawn by hand: a browser has none of its own. */
	input[role='switch'] {
		position: relative;
		flex: none;
		width: 51px;
		height: 31px;
		margin: 0;
		border-radius: 16px;
		background: light-dark(#e9e9ea, #39393d);
		appearance: none;
		cursor: pointer;
		transition: background 0.2s;
	}

	input[role='switch']::before {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 27px;
		height: 27px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 2px 4px rgb(0 0 0 / 0.2);
		content: '';
		transition: transform 0.2s;
	}

	input[role='switch']:checked {
		background: var(--blue);
	}

	input[role='switch']:checked::before {
		transform: translateX(20px);
	}

	.friends {
		display: flex;
		align-items: center;
		gap: 10px;
		width: calc(100% - 2 * var(--pad) - 34px);
		margin: 0 var(--pad) 10px calc(var(--pad) + 34px);
		padding: 8px 4px 8px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: none;
		text-align: left;
	}

	.faces {
		display: flex;
		flex: none;
	}

	/* Overlapping, as Instagram shows a few faces together. */
	.faces > :global(*:not(:first-child)) {
		margin-left: -8px;
		box-shadow: 0 0 0 2px var(--behind, var(--bg));
	}

	.names {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		font-weight: 600;
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
