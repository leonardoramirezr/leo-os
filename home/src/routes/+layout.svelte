<script lang="ts">
	import { Account } from '@leo-os/shared';
	import icon from '$lib/icon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={icon} />
</svelte:head>

<!-- The home screen is where the way home leads: the door here has none. -->
<Account home={false}>
	{@render children()}
</Account>

<style>
	/* Light or dark with the device, unless a theme was picked in Ajustes (@leo-os/shared's theme). */
	:global(:root) {
		color-scheme: light dark;
	}

	:global(html, body) {
		margin: 0;
		height: 100%;
	}

	:global(body) {
		font-family:
			-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif;
		-webkit-font-smoothing: antialiased;
		-webkit-tap-highlight-color: transparent;
		-webkit-user-select: none;
		user-select: none;
		overscroll-behavior: none;
	}
</style>
