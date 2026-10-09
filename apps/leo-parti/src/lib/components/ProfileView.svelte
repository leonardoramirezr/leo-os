<script lang="ts">
	// The account's profile: the same cover its bio opens with, and every post it has published in a
	// grid of three — in one tab those its bio lists, as others find them there, and in the other
	// those that only open by their link. «+» writes a new one.
	import { goto, pushState } from '$app/navigation';
	import { HomeButton } from '@leo-os/shared';
	import { bioLink } from '$lib/code';
	import { posts } from '$lib/posts.svelte';
	import { profile } from '$lib/profile.svelte';
	import ActionSheet, { type Action } from './ActionSheet.svelte';
	import Burst from './Burst.svelte';
	import Cover from './Cover.svelte';
	import Grid from './Grid.svelte';
	import Icon from './Icon.svelte';
	import ProfileSheet from './ProfileSheet.svelte';
	import Ticker from './Ticker.svelte';
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
						.share({ title: `${profile.username} en Leo Partī`, url: bioLink(profile.username) })
						.catch(() => {})
			});
		}
		list.push({ label: 'Ver tu bio', run: () => goto(bioLink(profile.username)) });
		return list;
	});
</script>

<div class="profile">
	<header class="masthead">
		<Wordmark />
		<div class="end">
			<button
				class="create"
				type="button"
				onclick={() => pushState('', { composing: true })}
				aria-label="Nueva publicación"
			>
				<Icon name="plus" size={22} stroke={2.8} />
			</button>
			<HomeButton />
		</div>
	</header>

	<Cover username={profile.username} avatar={profile.avatar} posts={posts.list.length} />

	<div class="buttons">
		<button class="secondary" type="button" onclick={() => (editing = true)}>Editar perfil</button>
		<button class="primary" type="button" onclick={() => (sharing = true)}>
			{copied ? 'Enlace copiado' : 'Compartir perfil'}
		</button>
	</div>

	<Ticker words="Publicaciones" />

	<div class="tabs" role="tablist" aria-label="Tus publicaciones">
		<button role="tab" type="button" aria-selected={tab === 'bio'} onclick={() => (picked = 'bio')}>
			<Icon name="grid" size={18} stroke={2.2} />
			<span>En tu bio</span>
		</button>
		<button role="tab" type="button" aria-selected={tab === 'link'} onclick={() => (picked = 'link')}>
			<Icon name="link" size={18} stroke={2.2} />
			<span>Solo con enlace</span>
		</button>
	</div>

	{#if posts.list.length === 0}
		<div class="empty-note">
			<Burst size={96} tilt={-8}><Icon name="camera" size={36} stroke={2} /></Burst>
			<h2 class="display">Comparte fotos</h2>
			<p>
				Cuando compartas una publicación, aparecerá en tu perfil, con un enlace para quien tú elijas:
				cualquiera, o solo algunos amigos.
			</p>
			<button class="primary" type="button" onclick={() => pushState('', { composing: true })}>
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
			<div class="empty-note">
				<h2 class="display">Tu bio está vacía</h2>
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
		<div class="empty-note">
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

	.masthead {
		justify-content: space-between;
	}

	.end {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	/* «+»: the one thing to do from here, so it is the lime one. */
	.create {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		padding: 0;
		border: var(--line) solid var(--ink);
		border-radius: 10px;
		background: var(--lime);
		color: var(--on-lime);
		box-shadow: 3px 3px 0 var(--ink);
	}

	.create:active {
		transform: translate(2px, 2px);
		box-shadow: 1px 1px 0 var(--ink);
	}

	.buttons {
		display: flex;
		gap: 10px;
		padding: 20px 16px 8px;
	}

	.buttons > * {
		flex: 1;
		white-space: nowrap;
	}

	/* Two halves of one outlined strip: the tab showing is inked. */
	.tabs {
		display: flex;
		margin: 0 16px 6px;
		overflow: hidden;
		border: var(--line) solid var(--ink);
		border-radius: 14px;
		background: var(--card);
	}

	.tabs button {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 40px;
		padding: 0 8px;
		border: 0;
		background: none;
		color: var(--muted);
		font-size: 14px;
		font-weight: 800;
	}

	.tabs button + button {
		border-left: var(--line) solid var(--ink);
	}

	.tabs button[aria-selected='true'] {
		background: var(--lilac);
		color: var(--on-lilac);
	}

	.pad {
		margin: 0;
		padding: 8px 16px 10px;
		text-align: center;
	}
</style>
