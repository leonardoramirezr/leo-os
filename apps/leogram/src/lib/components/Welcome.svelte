<script lang="ts">
	// The first time the account opens Leogram: it picks the username its posts will carry. One is
	// suggested out of its name, and anything here can be changed later in «Editar perfil».
	import { HomeButton, session } from '@leo-os/shared';
	import { profile, suggestUsername, USERNAME } from '$lib/profile.svelte';
	import ProfileFields from './ProfileFields.svelte';
	import Wordmark from './Wordmark.svelte';

	let username = $state(suggestUsername(session.account?.name ?? '', session.account?.email ?? ''));
	let avatar = $state('');
	let photo = $state<Blob | null>();
	let problem = $state('');
	let saving = $state(false);

	async function start(event: SubmitEvent) {
		event.preventDefault();
		if (!USERNAME.test(username)) {
			problem = 'Escribe un nombre de usuario.';
			return;
		}
		saving = true;
		try {
			await profile.save(username, photo);
		} catch (thrown) {
			problem = thrown instanceof Error ? thrown.message : 'No se pudo guardar el perfil.';
		} finally {
			saving = false;
		}
	}
</script>

<header class="bar welcome-bar">
	<HomeButton />
</header>

<form class="welcome" onsubmit={start}>
	<Wordmark height={64} />
	<h1 class="display">Elige tu nombre de usuario</h1>
	<p>
		Es el nombre con el que aparecerán tus publicaciones y tus comentarios. Puedes cambiarlo
		después.
	</p>

	<ProfileFields bind:username bind:avatar bind:photo bind:problem />
	{#if problem}
		<p class="error">{problem}</p>
	{/if}

	<button class="primary" type="submit" disabled={saving || !username}>
		{saving ? 'Un momento…' : 'Siguiente'}
	</button>
</form>

<style>
	/* As tall as the profile's bar, so the way home is where it will be there. */
	.bar {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		max-width: 935px;
		height: 56px;
		margin: 0 auto;
		padding: 0 10px;
	}

	.welcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 420px;
		min-height: calc(100dvh - 56px);
		margin: 0 auto;
		padding: 0 24px calc(24px + env(safe-area-inset-bottom));
		text-align: center;
	}

	h1 {
		margin: 28px 0 12px;
		font-size: 30px;
	}

	p {
		margin: 0;
		color: var(--muted);
	}

	.primary {
		width: 100%;
		max-width: 360px;
		margin-top: 20px;
	}
</style>
