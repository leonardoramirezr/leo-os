<script lang="ts">
	// «Editar perfil»: the photo and username everyone sees with the account's posts and comments.
	import { profile, USERNAME } from '$lib/profile.svelte';
	import ProfileFields from './ProfileFields.svelte';
	import Sheet from './Sheet.svelte';

	let { open = $bindable() }: { open: boolean } = $props();

	let username = $state('');
	let avatar = $state('');
	let photo = $state<Blob | null>();
	let problem = $state('');
	let saving = $state(false);

	// Each time it opens, what is saved, not what was left typed the time before.
	$effect(() => {
		if (!open) return;
		username = profile.username;
		avatar = profile.avatar;
		photo = undefined;
		problem = '';
	});

	async function save() {
		if (!USERNAME.test(username)) {
			problem = 'Escribe un nombre de usuario.';
			return;
		}
		saving = true;
		try {
			await profile.save(username, photo);
			open = false;
		} catch (thrown) {
			problem = thrown instanceof Error ? thrown.message : 'No se pudo guardar el perfil.';
		} finally {
			saving = false;
		}
	}
</script>

<Sheet bind:open title="Editar perfil">
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}
	{#snippet trailing()}
		<button class="text-button accent" type="button" onclick={save} disabled={saving}>
			{saving ? 'Guardando…' : 'Listo'}
		</button>
	{/snippet}

	<ProfileFields bind:username bind:avatar bind:photo bind:problem />
	{#if problem}
		<p class="error center">{problem}</p>
	{/if}
</Sheet>

<style>
	.center {
		padding: 0 16px;
		text-align: center;
	}
</style>
