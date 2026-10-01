<script lang="ts">
	// A profile's photo and username, as they are picked for the first time and as they are edited.
	// A new photo stays here until the form is saved, which is when it goes to the bucket.
	import { onDestroy } from 'svelte';
	import { avatar as shrink } from '$lib/images';
	import Avatar from './Avatar.svelte';

	let {
		username = $bindable(),
		avatar = $bindable(),
		photo = $bindable(),
		problem = $bindable()
	}: {
		username: string;
		/** What shows as the photo: the saved one's address, or the new one's on the device. */
		avatar: string;
		/** A new photo, or null to take the saved one off; undefined while it stays as it is. */
		photo: Blob | null | undefined;
		problem: string;
	} = $props();

	let picker: HTMLInputElement;
	let reading = $state(false);
	/** The addresses made here for photos on the device, given back when the form goes. */
	const made: string[] = [];

	onDestroy(() => {
		for (const url of made) URL.revokeObjectURL(url);
	});

	async function pick() {
		const file = picker.files?.[0];
		picker.value = '';
		if (!file) return;
		reading = true;
		try {
			const shrunk = await shrink(file);
			photo = shrunk;
			avatar = URL.createObjectURL(shrunk);
			made.push(avatar);
		} catch {
			problem = 'No se pudo leer esa foto.';
		} finally {
			reading = false;
		}
	}

	/** Lowercase, and only what a username may hold: what cannot be in it never gets typed. */
	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		const clean = event.currentTarget.value
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/\s/g, '.')
			.replace(/[^a-z0-9._]/g, '')
			.slice(0, 30);
		event.currentTarget.value = clean;
		username = clean;
		problem = '';
	}
</script>

<div class="fields">
	<button class="photo" type="button" onclick={() => picker.click()} disabled={reading}>
		<Avatar src={avatar} {username} size={96} />
		<span>{reading ? 'Leyendo…' : avatar ? 'Cambiar foto' : 'Elegir foto de perfil'}</span>
	</button>
	{#if avatar}
		<button
			class="remove"
			type="button"
			onclick={() => {
				avatar = '';
				photo = null;
			}}
		>
			Quitar foto
		</button>
	{/if}
	<input bind:this={picker} type="file" accept="image/*" hidden onchange={pick} />

	<label class="username">
		<span>Nombre de usuario</span>
		<input
			value={username}
			{oninput}
			autocapitalize="none"
			autocomplete="username"
			autocorrect="off"
			spellcheck="false"
			maxlength="30"
			required
		/>
	</label>
	<p class="hint">
		Así te ven todos en tus publicaciones y comentarios. Solo minúsculas, números, puntos y guiones
		bajos.
	</p>
</div>

<style>
	.fields {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 20px 16px;
	}

	.photo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 0;
		border: 0;
		background: none;
	}

	.photo span {
		color: var(--blue);
		font-weight: 600;
	}

	.remove {
		margin-top: 8px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--danger);
		font-size: 13px;
	}

	.username {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
		max-width: 360px;
		margin-top: 24px;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 12px;
	}

	.username span {
		color: var(--muted);
		font-size: 12px;
	}

	.username input {
		padding: 0;
		border: 0;
		outline: none;
		background: none;
		/* Under 16px iOS zooms in on the field. */
		font-size: 16px;
	}

	.hint {
		max-width: 360px;
		margin: 8px 0 0;
		text-align: center;
	}
</style>
