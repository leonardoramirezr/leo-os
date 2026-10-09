<script lang="ts" module>
	const icons = {
		settings: '<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
		back: '<path d="m15 18-6-6 6-6"/>',
		forward: '<path d="m9 18 6-6-6-6"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		sparkles:
			'<path d="M11 3.5c.5 3.6 2.4 5.5 6 6-3.6.5-5.5 2.4-6 6-.5-3.6-2.4-5.5-6-6 3.6-.5 5.5-2.4 6-6Z"/><path d="M18.5 15c.2 1.5.9 2.3 2.5 2.5-1.6.2-2.3 1-2.5 2.5-.2-1.5-1-2.3-2.5-2.5 1.5-.2 2.3-1 2.5-2.5Z"/>',
		close: '<path d="M18 6 6 18M6 6l12 12"/>',
		download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
		search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		edit: '<path d="M12 20h8.5"/><path d="M16.2 3.8a2.1 2.1 0 0 1 3 3L7.5 18.5 3.5 19.5l1-4Z"/>'
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
