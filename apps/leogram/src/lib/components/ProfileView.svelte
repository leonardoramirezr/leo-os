<script lang="ts">
	// The account's profile, as Instagram has it: its photo and username on top, and every post it
	// has published in a grid of three — in one tab those its bio lists, as others find them there,
	// and in the other those that only open by their link. «+» writes a new one.
	import { goto, pushState } from '$app/navigation';
	import { bioLink } from '$lib/code';
	import { count } from '$lib/format';
	import { posts } from '$lib/posts.svelte';
	import { profile } from '$lib/profile.svelte';
	import ActionSheet, { type Action } from './ActionSheet.svelte';
	import Avatar from './Avatar.svelte';
	import Grid from './Grid.svelte';
	import Icon from './Icon.svelte';
	import ProfileSheet from './ProfileSheet.svelte';
	import Wordmark from './Wordmark.svelte';

	let editing = $state(false);
	let sharing = $state(false);
	let copied = $state(false);
	/** The tab picked; until one is, the bio's, unless only the other one has posts. */
	let picked = $state<'bio' | 'link'>();

	const listed = $derived(posts.list.filter((post) => post.listed));
	const unlisted = $derived(posts.list.filter((post) => !post.listed));
	const tab = $derived(picked ?? (listed.length === 0 && unlisted.length > 0 ? 'link' : 'bio'));

	const open = (id: string) => pushState('', { post: id });

	async function copy() {
		try {
			await navigator.clipboard.writeText(bioLink(profile.username));
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard: «Ver tu bio» has the link in the address bar.
		}
	}

	const actions = $derived.by(() => {
		const list: Action[] = [{ label: 'Copiar enlace', run: copy }];
		if (typeof navigator !== 'undefined' && 'share' in navigator) {
			list.push({
				label: 'Compartir…',
				run: () =>
					navigator
						.share({ title: `${profile.username} en Leogram`, url: bioLink(profile.username) })
						.catch(() => {})
			});
		}
		list.push({ label: 'Ver tu bio', run: () => goto(bioLink(profile.username)) });
		return list;
	});
</script>

<div class="profile">
	<header class="top">
		<Wordmark />
		<button
			class="icon-button"
			type="button"
			onclick={() => pushState('', { composing: true })}
			aria-label="Nueva publicación"
		>
			<Icon name="create" size={26} />
		</button>
	</header>

	<section class="who">
		<Avatar src={profile.avatar} username={profile.username} size={86} ring />
		<div class="side">
			<h1>{profile.username}</h1>
			<p>
				<strong>{count(posts.list.length)}</strong>
				{posts.list.length === 1 ? 'publicación' : 'publicaciones'}
			</p>
		</div>
	</section>

	<div class="buttons">
		<button class="secondary" type="button" onclick={() => (editing = true)}>Editar perfil</button>
		<button class="secondary" type="button" onclick={() => (sharing = true)}>
			{copied ? 'Enlace copiado' : 'Compartir perfil'}
		</button>
	</div>

	<div class="tabs" role="tablist" aria-label="Tus publicaciones">
		<button role="tab" type="button" aria-selected={tab === 'bio'} onclick={() => (picked = 'bio')}>
			<Icon name="grid" size={20} />
			<span>En tu bio</span>
		</button>
		<button role="tab" type="button" aria-selected={tab === 'link'} onclick={() => (picked = 'link')}>
			<Icon name="link" size={20} />
			<span>Solo con enlace</span>
		</button>
	</div>

	{#if posts.list.length === 0}
		<div class="empty">
			<span class="circle"><Icon name="camera" size={40} stroke={1.5} /></span>
			<h2>Comparte fotos</h2>
			<p>
				Cuando compartas una publicación, aparecerá en tu perfil, con un enlace para quien tú elijas:
				cualquiera, o solo algunos amigos.
			</p>
			<button class="link" type="button" onclick={() => pushState('', { composing: true })}>
				Comparte tu primera foto
			</button>
		</div>
	{:else if tab === 'bio'}
		{#if listed.length > 0}
			<p class="hint pad">
				Así aparecen en tu bio: las de enlace, para todos; las de amigos, solo para esos amigos.
			</p>
			<Grid posts={listed} onopen={open} />
		{:else}
			<div class="empty">
				<h2>Tu bio está vacía</h2>
				<p>
					Al publicar, activa «Listar en mi bio» para que una publicación aparezca aquí y en tu bio,
					para quien pueda verla. Las que ya tienes se cambian desde su «⋯».
				</p>
			</div>
		{/if}
	{:else if unlisted.length > 0}
		<p class="hint pad">No aparecen en tu bio: solo se abren con su enlace.</p>
		<Grid posts={unlisted} onopen={open} />
	{:else}
		<div class="empty">
			<p>Todas tus publicaciones están en tu bio.</p>
		</div>
	{/if}
</div>

<ProfileSheet bind:open={editing} />
<ActionSheet bind:open={sharing} {actions} />

<style>
	.profile {
		max-width: 935px;
		min-height: 100dvh;
		margin: 0 auto;
		padding-bottom: env(safe-area-inset-bottom);
	}

	.top {
		display: flex;
		position: sticky;
		z-index: 10;
		top: 0;
		align-items: center;
		justify-content: space-between;
		height: 56px;
		padding: 6px 8px 0 16px;
		background: var(--bg);
	}

	.who {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 12px 16px 0;
	}

	.side {
		min-width: 0;
	}

	h1 {
		margin: 0 0 6px;
		overflow: hidden;
		font-size: 20px;
		font-weight: 600;
		line-height: 25px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.side p {
		margin: 0;
		font-size: 15px;
	}

	.buttons {
		display: flex;
		gap: 8px;
		padding: 16px;
	}

	.buttons .secondary {
		flex: 1;
	}

	.tabs {
		display: flex;
		border-top: 1px solid var(--border);
	}

	.tabs button {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px 0;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: 13px;
		font-weight: 600;
	}

	/* As Instagram marks the tab showing: a line under it. */
	.tabs button[aria-selected='true'] {
		color: var(--text);
		box-shadow: inset 0 -1px 0 var(--text);
	}

	.pad {
		margin: 0;
		padding: 8px 16px 10px;
		text-align: center;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 48px 32px;
		text-align: center;
	}

	.circle {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border: 2px solid var(--text);
		border-radius: 50%;
	}

	.empty h2 {
		margin: 4px 0 0;
		font-size: 24px;
		font-weight: 800;
		line-height: 30px;
	}

	.empty p {
		max-width: 340px;
		margin: 0;
		color: var(--muted);
	}

	.empty .link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--blue);
		font-weight: 600;
	}
</style>
