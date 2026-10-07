<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { routines } from '$lib/routines.svelte';
	import { sessions } from '$lib/sessions.svelte';
	import { workout } from '$lib/workout.svelte';

	let { children } = $props();

	// Coming back to the app, the routines and the history are read again, in case they changed on
	// another device. Not in the middle of a workout: it is this device's, and its sets are on their way.
	$effect(() => {
		const onvisible = () => {
			if (document.visibilityState !== 'visible' || workout.active) return;
			routines.refresh();
			sessions.refresh();
		};
		document.addEventListener('visibilitychange', onvisible);
		return () => document.removeEventListener('visibilitychange', onvisible);
	});

	async function load(userId: string) {
		await Promise.all([routines.load(userId), sessions.load(userId)]);
		workout.restore();
	}
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account {load}>
	{@render children()}
</Account>
