<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { draft } from '$lib/draft.svelte';
	import { prompts } from '$lib/prompts.svelte';

	let { children } = $props();

	// Leaving the app, the text goes out at once rather than a moment later: iOS may stop it in the
	// background. Coming back, both are read again, in case they changed on another device.
	$effect(() => {
		const onvisible = () => {
			if (document.visibilityState === 'hidden') {
				draft.flush();
				return;
			}
			prompts.refresh();
			draft.refresh();
		};
		document.addEventListener('visibilitychange', onvisible);
		return () => document.removeEventListener('visibilitychange', onvisible);
	});

	async function load(userId: string) {
		await Promise.all([prompts.load(userId), draft.load(userId)]);
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account {load}>
	{@render children()}
</Account>
