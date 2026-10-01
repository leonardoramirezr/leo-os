<script lang="ts" module>
	// Outlines in the manner of Instagram's, drawn for this app on a 24-unit grid.
	const icons = {
		heart:
			'<path d="M12 20.5s-7.6-4.5-9.3-9.4C1.5 7.5 3.8 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4c3.6 0 5.9 3.5 4.7 7.1-1.7 4.9-9.3 9.4-9.3 9.4Z"/>',
		liked:
			'<path fill="currentColor" d="M12 20.5s-7.6-4.5-9.3-9.4C1.5 7.5 3.8 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4c3.6 0 5.9 3.5 4.7 7.1-1.7 4.9-9.3 9.4-9.3 9.4Z"/>',
		comment: '<path d="M4.6 15.8A8.5 8.5 0 1 1 8.4 19.2L3.5 20.5Z"/>',
		share: '<path d="M21.5 3.5 10.6 13.4"/><path d="M21.5 3.5 14.7 21l-4.1-7.6L3 9.4Z"/>',
		more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>',
		create: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
		plus: '<path d="M12 5v14M5 12h14"/>',
		carousel:
			'<rect x="8" y="3" width="13" height="13" rx="2.5" fill="currentColor"/><path d="M16 21H5.5A2.5 2.5 0 0 1 3 18.5V8"/>',
		music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
		sound: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
		muted: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
		close: '<path d="M18 6 6 18M6 6l12 12"/>',
		back: '<path d="m15 18-6-6 6-6"/>',
		forward: '<path d="m9 18 6-6-6-6"/>',
		link: '<path d="M10 13a5 5 0 0 0 7.1 0l2.9-2.9a5 5 0 0 0-7.1-7.1L11.5 4.4"/><path d="M14 11a5 5 0 0 0-7.1 0L4 13.9a5 5 0 0 0 7.1 7.1l1.4-1.4"/>',
		trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="m5.5 7 1 12.5a2 2 0 0 0 2 1.5h7a2 2 0 0 0 2-1.5l1-12.5M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
		grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
		camera: '<rect x="2.5" y="6" width="19" height="14" rx="3"/><circle cx="12" cy="13" r="4"/><path d="m8.5 6 1.5-2.5h4L15.5 6"/>',
		photo: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="m21 15-5-5L5 21"/>',
		play: '<path d="M7 4.5v15l12-7.5Z" fill="currentColor"/>',
		video:
			'<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M3 8.5h18M8.5 3l2.5 5.5M14 3l2.5 5.5"/><path d="M10 12v5.5l4.75-2.75Z" fill="currentColor"/>',
		pause: '<path d="M8 5v14M16 5v14"/>',
		search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
		upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
		check: '<path d="M20 6 9 17l-5-5"/>',
		person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
		square: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
		portrait: '<rect x="6" y="4.5" width="12" height="15" rx="1.5"/>',
		landscape: '<rect x="2.5" y="7" width="19" height="10" rx="1.5"/>'
	};

	export type IconName = keyof typeof icons;
</script>

<script lang="ts">
	let { name, size = 24, stroke = 2 }: { name: IconName; size?: number; stroke?: number } = $props();
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
