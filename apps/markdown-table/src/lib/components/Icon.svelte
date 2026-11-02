<script lang="ts" module>
	const icons = {
		back: '<path d="m15 18-6-6 6-6"/>',
		forward: '<path d="m9 18 6-6-6-6"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
		paste: '<rect x="8" y="2.5" width="8" height="4" rx="1.2"/><path d="M16 4.5h1.5A2.5 2.5 0 0 1 20 7v12.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 19.5V7a2.5 2.5 0 0 1 2.5-2.5H8"/>',
		more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
		undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
		redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
		share: '<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M8 11H6.5A2.5 2.5 0 0 0 4 13.5v5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-5a2.5 2.5 0 0 0-2.5-2.5H16"/>',
		download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
		trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
		table: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M3 15h18M9 10v10M15 10v10"/>',
		image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
		markdown: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M6 15V9l2.5 3L11 9v6M16.5 9v6M14.2 12.8l2.3 2.2 2.3-2.2"/>',
		'align-left': '<path d="M4 6h16M4 12h10M4 18h13"/>',
		'align-center': '<path d="M4 6h16M7 12h10M5.5 18h13"/>',
		'align-right': '<path d="M4 6h16M10 12h10M7 18h13"/>',
		'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
		'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>',
		'arrow-left': '<path d="M19 12H5M12 19l-7-7 7-7"/>',
		'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
		'sort-up': '<path d="M7 4v16M3 16l4 4 4-4"/><path d="M14 5h3M14 11h5M14 17h7"/>',
		'sort-down': '<path d="M7 4v16M3 16l4 4 4-4"/><path d="M14 5h7M14 11h5M14 17h3"/>',
		'row-above': '<rect x="3" y="12" width="18" height="8" rx="2"/><path d="M12 3v6M9 6h6"/>',
		'row-below': '<rect x="3" y="4" width="18" height="8" rx="2"/><path d="M12 15v6M9 18h6"/>',
		'column-left': '<rect x="12" y="3" width="8" height="18" rx="2"/><path d="M3 12h6M6 9v6"/>',
		'column-right': '<rect x="4" y="3" width="8" height="18" rx="2"/><path d="M15 12h6M18 9v6"/>'
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
