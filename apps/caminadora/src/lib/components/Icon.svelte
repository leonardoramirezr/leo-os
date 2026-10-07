<script lang="ts" module>
	const icons = {
		apps: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
		forward: '<path d="m9 18 6-6-6-6"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		minus: '<path d="M5 12h14"/>',
		close: '<path d="M18 6 6 18M6 6l12 12"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		edit: '<path d="M12 20h8.5"/><path d="M16.2 3.8a2.1 2.1 0 0 1 3 3L7.5 18.5 3.5 19.5l1-4Z"/>',
		play: '<path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7Z" fill="currentColor"/>',
		pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>'
	};

	export type IconName = keyof typeof icons;
</script>

<script lang="ts">
	let { name, size = 20, stroke = 2 }: { name: IconName; size?: number; stroke?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
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
