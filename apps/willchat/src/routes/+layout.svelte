<script lang="ts">
	import '../app.css';
	import icon from '../../icon.svg';
	import { Account } from '@leo-os/shared';
	import { lang } from '$lib/i18n';

	let { children } = $props();

	document.documentElement.lang = lang;
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href={icon} />
</svelte:head>

<Account {lang}>
	{@render children()}
</Account>
