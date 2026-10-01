<script lang="ts">
	// The first time the account opens Leogram: it picks the username its posts will carry. One is
	// suggested out of its name, and anything here can be changed later in «Editar perfil».
	import { session } from '@leo-os/shared';
	import { profile, suggestUsername, USERNAME } from '$lib/profile.svelte';
	import ProfileFields from './ProfileFields.svelte';
	import Wordmark from './Wordmark.svelte';

	let username = $state(suggestUsername(session.account?.name ?? '', session.account?.email ?? ''));
	let avatar = $state('');
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
			await profile.save(username, avatar);
		} catch (thrown) {
			problem = thrown instanceof Error ? thrown.message : 'No se pudo guardar el perfil.';
		} finally {
			saving = false;
		}
	}
</script>

<form class="welcome" onsubmit={start}>
	<Wordmark height={52} />
	<h1>Elige tu nombre de usuario</h1>
	<p>
		Es el nombre con el que aparecerán tus publicaciones y tus comentarios. Puedes cambiarlo
		después.
	</p>

	<ProfileFields bind:username bind:avatar bind:problem />
	{#if problem}
		<p class="error">{problem}</p>
	{/if}

	<button class="primary" type="submit" disabled={saving || !username}>
		{saving ? 'Un momento…' : 'Siguiente'}
	</button>
</form>

<style>
	.welcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 420px;
		min-height: 100dvh;
		margin: 0 auto;
		padding: 48px 24px calc(24px + env(safe-area-inset-bottom));
		text-align: center;
	}

	h1 {
		margin: 24px 0 8px;
		font-size: 20px;
		line-height: 26px;
	}

	p {
		margin: 0;
		color: var(--muted);
	}

	.primary {
		width: 100%;
		max-width: 360px;
		margin-top: 16px;
	}
</style>
