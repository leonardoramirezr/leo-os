<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { answers } from '$lib/answers.svelte';
	import { templates } from '$lib/templates.svelte';

	let { children } = $props();

	// The templates may have changed on another device while this one sat in the background.
	$effect(() => {
		const refresh = () => {
			if (document.visibilityState === 'visible') templates.refresh();
		};
		document.addEventListener('visibilitychange', refresh);
		return () => document.removeEventListener('visibilitychange', refresh);
	});

	$effect(() => answers.listen());

	async function load(userId: string) {
		await templates.load(userId);
		await answers.load(userId, templates.list.map((template) => template.id));
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account {load}>
	{@render children()}
</Account>
