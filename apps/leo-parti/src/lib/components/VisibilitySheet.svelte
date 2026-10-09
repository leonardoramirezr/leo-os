<script lang="ts">
	// «Quién la ve», for a post already published: the composer's same choice, saved for everybody at
	// once. Its link stops opening for whoever is left out, and starts opening for whoever is added.
	import { isExpired, session } from '@leo-os/shared';
	import { untrack } from 'svelte';
	import type { Person } from '$lib/people.svelte';
	import { share, type Audience, type Visibility } from '$lib/post';
	import Sheet from './Sheet.svelte';
	import VisibilityFields from './VisibilityFields.svelte';

	let {
		open = $bindable(),
		code,
		current,
		onsaved
	}: {
		open: boolean;
		code: string;
		/** Who it is for now. */
		current: Visibility;
		onsaved: (visibility: Visibility) => void;
	} = $props();

	let audience = $state<Audience>('link');
	let friends = $state<Person[]>([]);
	let listed = $state(false);
	let problem = $state('');
	let saving = $state(false);

	// Each time it opens, what is saved, not what was left picked the time before; and only then: the
	// post read again while it is open leaves what is being picked alone.
	$effect.pre(() => {
		if (!open) return;
		untrack(() => {
			audience = current.audience;
			friends = [...current.friends];
			listed = current.listed;
			problem = '';
		});
	});

	async function save() {
		if (audience === 'friends' && friends.length === 0) {
			problem = 'Elige al menos a un amigo.';
			return;
		}
		const chosen: Visibility = { audience, listed, friends: audience === 'friends' ? friends : [] };
		saving = true;
		problem = '';
		try {
			await share(code, chosen);
			onsaved(chosen);
			open = false;
		} catch (thrown) {
			if (isExpired(thrown)) session.expire();
			problem = thrown instanceof Error && thrown.message ? thrown.message : 'No se pudo guardar.';
		} finally {
			saving = false;
		}
	}
</script>

<Sheet bind:open title="Quién la ve">
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}
	{#snippet trailing()}
		<button class="text-button accent" type="button" onclick={save} disabled={saving}>
			{saving ? 'Guardando…' : 'Listo'}
		</button>
	{/snippet}

	<!-- Made anew each time, already showing what is saved: kept from the last time, its switch and
	     radios would be seen sliding over to it. -->
	{#if open}
		<VisibilityFields
			--side="16px"
			titled={false}
			bind:audience
			bind:friends
			bind:listed
		/>
	{/if}
	{#if problem}
		<p class="error pad">{problem}</p>
	{/if}
</Sheet>

<style>
	.pad {
		padding: 0 16px;
	}
</style>
