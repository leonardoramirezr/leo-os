<script lang="ts" module>
	const icons = {
		back: '<path d="m15 18-6-6 6-6"/>',
		forward: '<path d="m9 18 6-6-6-6"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		edit: '<path d="M12 20h8.5"/><path d="M16.2 3.8a2.1 2.1 0 0 1 3 3L7.5 18.5 3.5 19.5l1-4Z"/>',
		copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
		eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
		blank: '<path d="M8 5H5v14h3M16 5h3v14h-3"/><path d="M9.5 12h5"/>'
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
