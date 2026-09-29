<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import { apps, dock, type App } from '$lib/apps';
	import { paintStatusBar, statusBarColor } from '$lib/color';
	import SettingsSheet from '$lib/SettingsSheet.svelte';
	import { statusBar, ui, wallpaper } from '$lib/settings.svelte';
	import StatusBar from '$lib/StatusBar.svelte';

	// Keep in sync with the iPad media query below and in StatusBar.svelte.
	const large = new MediaQuery('(min-width: 640px) and (min-height: 640px)');

	// iPhone: 4 columns × 6 rows. iPad: 6 × 5 in landscape, 5 × 6 in portrait.
	const pageSize = $derived(large.current ? 30 : 24);

	const pages = $derived(
		Array.from({ length: Math.max(1, Math.ceil(apps.length / pageSize)) }, (_, i) =>
			apps.slice(i * pageSize, (i + 1) * pageSize)
		)
	);

	let currentPage = $state(0);

	function onscroll({ currentTarget: pager }: UIEvent & { currentTarget: HTMLElement }) {
		currentPage = Math.round(pager.scrollLeft / pager.clientWidth);
	}

	// The band above the wallpaper takes the colour picked in Ajustes, or the one being tried there.
	const barColor = $derived(statusBarColor(ui.statusBarTrial || statusBar.value));

	$effect(() => paintStatusBar(barColor));
</script>

<!-- iOS Safari only marks what is being touched as :active when a touch listener sits on it or above
     it: without this one, tapping an icon would not dim it. -->
<svelte:document ontouchstart={() => {}} />

{#snippet tile(app: App, labelled: boolean)}
	{#if 'href' in app}
		<a class="app" href={app.href} data-sveltekit-reload aria-label={labelled ? undefined : app.name}>
			{@render face(app, labelled)}
		</a>
	{:else}
		<button
			class="app"
			type="button"
			onclick={app.action}
			aria-label={labelled ? undefined : app.name}
		>
			{@render face(app, labelled)}
		</button>
	{/if}
{/snippet}

{#snippet face(app: App, labelled: boolean)}
	<span class="icon"><img src={app.icon} alt="" draggable="false" /></span>
	{#if labelled}
		<span class="label">{app.name}</span>
	{/if}
{/snippet}

<div
	class="screen"
	class:custom-wallpaper={wallpaper.value}
	style:background-image={wallpaper.value ? `url(${wallpaper.value})` : undefined}
>
	<StatusBar />

	<div class="pager" {onscroll}>
		{#each pages as page, index (index)}
			<nav class="page" aria-label="Apps">
				{#each page as app (app.slug)}
					{@render tile(app, true)}
				{/each}
			</nav>
		{/each}
	</div>

	<div class="dots" aria-hidden="true">
		{#each pages as _, index (index)}
			<span class="dot" class:active={index === Math.min(currentPage, pages.length - 1)}></span>
		{/each}
	</div>

	<!-- As on iOS, the icons in the dock go without their names. -->
	<nav class="dock" aria-label="Dock">
		{#each dock as app (app.slug)}
			{@render tile(app, false)}
		{/each}
	</nav>
</div>

<SettingsSheet bind:open={ui.settingsOpen} />

<style>
	/* All sizes are expressed in device points (`--u`), scaled to fit the viewport. */
	.screen {
		--u: min(1px, calc(100vw / 390));
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding-top: calc(env(safe-area-inset-top) + 24 * var(--u));
		padding-bottom: calc(env(safe-area-inset-bottom) + 10 * var(--u));
		background:
			radial-gradient(90% 55% at 0% 0%, rgb(255 150 90 / 0.95), transparent 70%),
			radial-gradient(80% 50% at 100% 18%, rgb(240 70 160 / 0.9), transparent 70%),
			radial-gradient(100% 60% at 0% 100%, rgb(40 120 255 / 0.9), transparent 70%),
			radial-gradient(90% 55% at 100% 85%, rgb(130 70 240 / 0.95), transparent 70%),
			linear-gradient(170deg, #4a2a8a, #1c1446);
	}

	/* The wallpaper picked in Ajustes, set inline as a background-image, replaces the gradients. */
	.screen.custom-wallpaper {
		background-position: center;
		background-repeat: no-repeat;
		background-size: cover;
		background-color: #1c1446;
	}

	.pager {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
	}

	.pager::-webkit-scrollbar {
		display: none;
	}

	.page {
		flex: 0 0 100%;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		grid-auto-rows: max-content;
		align-content: start;
		row-gap: calc(24 * var(--u));
		box-sizing: border-box;
		padding: calc(8 * var(--u)) calc(18 * var(--u));
		overflow-y: auto;
		scroll-snap-align: start;
	}

	.app {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: calc(6 * var(--u));
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: #fff;
		text-decoration: none;
		outline: none;
		cursor: pointer;
		/* Holding an icon down would bring up Safari's preview of the link. */
		-webkit-touch-callout: none;
	}

	.icon {
		position: relative;
		display: block;
		width: calc(62 * var(--u));
		height: calc(62 * var(--u));
		border-radius: 22.5%;
		/* A tight shadow where the icon meets the wallpaper and a wide, faint one under it: either
		   alone reads as a sticker or as a smudge. */
		box-shadow:
			0 calc(0.5 * var(--u)) calc(1.5 * var(--u)) rgb(0 0 0 / 0.16),
			0 calc(5 * var(--u)) calc(15 * var(--u)) rgb(0 0 0 / 0.2);
	}

	.icon img {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: inherit;
	}

	/* Over the artwork: the light iOS 26 catches on an icon's edge, and the dimming of a press. Both
	   are layered on top because nothing sharp in an icon goes through a filter (README.md, «Home
	   screen icon»). */
	.icon::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow:
			inset calc(0.75 * var(--u)) calc(1 * var(--u)) calc(0.5 * var(--u)) calc(-0.25 * var(--u))
				rgb(255 255 255 / 0.45),
			inset calc(-0.75 * var(--u)) calc(-1 * var(--u)) calc(0.5 * var(--u)) calc(-0.25 * var(--u))
				rgb(255 255 255 / 0.18),
			inset 0 0 0 calc(0.5 * var(--u)) rgb(255 255 255 / 0.12);
		transition: background-color 0.2s;
	}

	.app:active .icon::after {
		background-color: rgb(0 0 0 / 0.3);
		transition: none;
	}

	.app:focus-visible .icon {
		outline: 2px solid #fff;
		outline-offset: 3px;
	}

	.label {
		max-width: calc(78 * var(--u));
		overflow: hidden;
		font-size: calc(12 * var(--u));
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: 0.01em;
		text-align: center;
		text-overflow: ellipsis;
		/* A soft dark halo, as iOS gives its labels: faint on a dark wallpaper, and what keeps white
		   text readable over a bright photo. */
		text-shadow:
			0 calc(0.5 * var(--u)) calc(1 * var(--u)) rgb(0 0 0 / 0.45),
			0 0 calc(3 * var(--u)) rgb(0 0 0 / 0.4),
			0 0 calc(8 * var(--u)) rgb(0 0 0 / 0.25);
		white-space: nowrap;
	}

	.dots {
		display: flex;
		flex: none;
		justify-content: center;
		gap: calc(8 * var(--u));
		padding: calc(12 * var(--u)) 0;
	}

	.dot {
		width: calc(7 * var(--u));
		height: calc(7 * var(--u));
		border-radius: 50%;
		background: rgb(255 255 255 / 0.35);
	}

	.dot.active {
		background: #fff;
	}

	/* Glass, like the iOS 26 dock: the wallpaper blurred through it, light caught along its rim, and
	   a soft shadow under it. Brightened in the light theme; in the dark one, smoked about as much as
	   iOS's own, measured on a screenshot. */
	.dock {
		display: flex;
		flex: none;
		justify-content: center;
		/* 10 + 8 a side leaves the grid's width inside, so four icons line up with its columns. */
		margin: 0 calc(10 * var(--u));
		padding: calc(16 * var(--u)) calc(8 * var(--u));
		border-radius: calc(38 * var(--u));
		background: light-dark(rgb(255 255 255 / 0.16), rgb(0 0 0 / 0.5));
		-webkit-backdrop-filter: blur(20px) saturate(1.4);
		backdrop-filter: blur(20px) saturate(1.4);
		box-shadow:
			inset calc(1 * var(--u)) calc(1.5 * var(--u)) calc(1 * var(--u)) calc(-0.5 * var(--u))
				light-dark(rgb(255 255 255 / 0.5), rgb(255 255 255 / 0.3)),
			inset calc(-1 * var(--u)) calc(-1.5 * var(--u)) calc(1 * var(--u)) calc(-0.5 * var(--u))
				light-dark(rgb(255 255 255 / 0.25), rgb(255 255 255 / 0.15)),
			inset 0 0 0 calc(0.5 * var(--u)) light-dark(rgb(255 255 255 / 0.12), rgb(255 255 255 / 0.1)),
			0 calc(8 * var(--u)) calc(30 * var(--u)) rgb(0 0 0 / 0.14);
	}

	.dock .app {
		flex: 0 0 25%;
	}

	/* On larger screens, fill the viewport with an iPad home screen (1180 × 820 points in landscape). */
	@media (min-width: 640px) and (min-height: 640px) {
		.screen {
			--u: clamp(0.75px, min(100vw / 1180, 100dvh / 820), 1.5px);
			padding-top: 0;
			padding-bottom: calc(12 * var(--u));
		}

		.page {
			grid-template-columns: repeat(6, 1fr);
			grid-template-rows: repeat(5, 1fr);
			align-content: stretch;
			row-gap: 0;
			padding: calc(28 * var(--u)) calc(80 * var(--u)) 0;
		}

		.app {
			align-self: start;
			gap: calc(8 * var(--u));
		}

		.icon {
			width: calc(76 * var(--u));
			height: calc(76 * var(--u));
		}

		.label {
			max-width: calc(110 * var(--u));
			font-size: calc(13 * var(--u));
		}

		.dots {
			padding: calc(16 * var(--u)) 0;
		}

		/* The iPad's dock floats, as wide as the icons in it. */
		.dock {
			align-self: center;
			gap: calc(20 * var(--u));
			margin: 0;
			padding: calc(12 * var(--u));
			border-radius: calc(30 * var(--u));
		}

		.dock .app {
			flex: none;
		}
	}

	@media (min-width: 640px) and (min-height: 640px) and (max-aspect-ratio: 1/1) {
		.screen {
			--u: clamp(0.75px, min(100vw / 820, 100dvh / 1180), 1.5px);
		}

		.page {
			grid-template-columns: repeat(5, 1fr);
			grid-template-rows: repeat(6, 1fr);
			padding-inline: calc(48 * var(--u));
		}
	}

	/* Added to the home screen, the site reaches the bottom edge, where iOS draws its home indicator
	   over whatever is there. The dock floats as high over it as the iOS 26 one does: 12 points,
	   measured on an iPhone screenshot. */
	@media (display-mode: standalone) {
		.screen {
			padding-bottom: calc(env(safe-area-inset-bottom) + 12 * var(--u));
		}
	}
</style>
