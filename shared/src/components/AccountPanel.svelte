<script lang="ts">
	// Who is signed in and the way out, drawn as one more group of an iOS settings sheet.
	//
	// The colours follow the app's own when it defines them (WillChat has a light theme too); the
	// fallbacks are the dark sheet the home screen uses.
	import { session } from '../session.svelte';
	import { text, type Lang } from './text';

	let { lang = 'es' }: { lang?: Lang } = $props();

	const t = $derived(text[lang]);
</script>

<h3>{t.account}</h3>
<div class="group">
	<p class="who">{session.account?.email || session.account?.name || ''}</p>
	<button onclick={() => session.signOut()} disabled={session.busy}>{t.signOut}</button>
</div>

<style>
	h3 {
		margin: 20px 16px 8px;
		color: var(--muted, #98989f);
		font-size: 13px;
		font-weight: 400;
		letter-spacing: 0.02em;
		text-transform: uppercase;
	}

	.group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 16px;
		border-radius: 12px;
		background: var(--group, #2c2c2e);
	}

	.who {
		overflow: hidden;
		margin: 0;
		font-size: 17px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	button {
		flex: none;
		padding: 0;
		border: 0;
		background: none;
		color: var(--danger, #ff453a);
		font: inherit;
		font-size: 17px;
		cursor: pointer;
	}

	button:disabled {
		color: var(--muted, #98989f);
		cursor: default;
	}
</style>
