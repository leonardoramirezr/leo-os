<script lang="ts" module>
	const icons = {
		apps: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
		compose:
			'<path d="M11.5 3.5H7a3.5 3.5 0 0 0-3.5 3.5v10A3.5 3.5 0 0 0 7 20.5h10a3.5 3.5 0 0 0 3.5-3.5v-4.5"/><path d="M18.3 3.2a2 2 0 0 1 2.9 2.9l-8.1 8.1-3.9 1 1-3.9Z"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		send: '<path d="M12 19V5M6 11l6-6 6 6"/>',
		mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M19 10.5a7 7 0 0 1-14 0M12 17.5V21M8.5 21h7"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		stop: '<rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
		close: '<path d="M18 6 6 18M6 6l12 12"/>',
		chevron: '<path d="m7 10 5 5 5-5"/>',
		download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>'
	};

	export type IconName = keyof typeof icons;
</script>

<script lang="ts">
	let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{@html icons[name]}
</svg>

<style>
	svg {
		display: block;
		flex: none;
	}
</style>
