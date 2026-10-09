<script lang="ts" module>
	const icons = {
		settings: '<path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
		mic: '<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M19 10.5a7 7 0 0 1-14 0M12 17.5V21M8.5 21h7"/>',
		stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" stroke="none"/>',
		close: '<path d="M18 6 6 18M6 6l12 12"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
		redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
		copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
		compose:
			'<path d="M11.5 3.5H7a3.5 3.5 0 0 0-3.5 3.5v10A3.5 3.5 0 0 0 7 20.5h10a3.5 3.5 0 0 0 3.5-3.5v-4.5"/><path d="M18.3 3.2a2 2 0 0 1 2.9 2.9l-8.1 8.1-3.9 1 1-3.9Z"/>',
		sparkles:
			'<path d="M11 3.5c.5 3.6 2.4 5.5 6 6-3.6.5-5.5 2.4-6 6-.5-3.6-2.4-5.5-6-6 3.6-.5 5.5-2.4 6-6Z"/><path d="M18.5 15c.2 1.5.9 2.3 2.5 2.5-1.6.2-2.3 1-2.5 2.5-.2-1.5-1-2.3-2.5-2.5 1.5-.2 2.3-1 2.5-2.5Z"/>',
		wand: '<path d="m3.5 20.5 10-10"/><path d="M16.5 3c.4 2.6 1.6 3.9 4.2 4.2-2.6.4-3.8 1.6-4.2 4.2-.4-2.6-1.6-3.8-4.2-4.2 2.6-.3 3.8-1.6 4.2-4.2Z"/><path d="M6.5 3.5v3M5 5h3"/>',
		back: '<path d="m15 18-6-6 6-6"/>',
		forward: '<path d="m9 18 6-6-6-6"/>'
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
