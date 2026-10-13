<script lang="ts">
	// The menu that slides in from the left, as in ChatGPT: the chat, the mini apps, and the settings.
	import { t } from '$lib/i18n';
	import Icon, { type IconName } from './Icon.svelte';

	type View = 'chat' | 'mini-apps';

	interface Props {
		open: boolean;
		current: View;
		onselect: (view: View) => void;
		onsettings: () => void;
	}

	let { open = $bindable(), current, onselect, onsettings }: Props = $props();

	let dialog: HTMLDialogElement;

	const items: { view: View; icon: IconName; label: string }[] = [
		{ view: 'chat', icon: 'chat', label: t.conversations },
		{ view: 'mini-apps', icon: 'spark', label: t.miniApps }
	];

	$effect(() => {
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function select(view: View) {
		dialog.close();
		onselect(view);
	}

	function settings() {
		dialog.close();
		onsettings();
	}
</script>

<dialog
	bind:this={dialog}
	aria-label={t.menu}
	onclose={() => (open = false)}
	onclick={(event) => {
		if (event.target === dialog) dialog.close();
	}}
>
	<nav>
		<header>
			<span>WillChat</span>
			<button class="icon-button" onclick={() => dialog.close()} aria-label={t.close} title={t.close}>
				<Icon name="close" />
			</button>
		</header>

		<ul>
			{#each items as item (item.view)}
				<li>
					<button
						class="item"
						class:current={item.view === current}
						aria-current={item.view === current ? 'page' : undefined}
						onclick={() => select(item.view)}
					>
						<Icon name={item.icon} />
						{item.label}
					</button>
				</li>
			{/each}
		</ul>

		<button class="item settings" onclick={settings}>
			<Icon name="settings" />
			{t.settings}
		</button>
	</nav>
</dialog>

<style>
	dialog {
		width: min(300px, 85vw);
		max-width: none;
		height: 100%;
		max-height: none;
		margin: 0 auto 0 0;
		padding: 0;
		border: 0;
		background: var(--sheet);
		transition:
			transform 0.25s ease,
			overlay 0.25s allow-discrete,
			display 0.25s allow-discrete;
		transform: translateX(-100%);
	}

	dialog[open] {
		transform: none;
	}

	@starting-style {
		dialog[open] {
			transform: translateX(-100%);
		}
	}

	dialog::backdrop {
		transition:
			opacity 0.25s ease,
			overlay 0.25s allow-discrete,
			display 0.25s allow-discrete;
		opacity: 0;
	}

	dialog[open]::backdrop {
		opacity: 1;
	}

	@starting-style {
		dialog[open]::backdrop {
			opacity: 0;
		}
	}

	nav {
		display: flex;
		flex-direction: column;
		height: 100%;
		padding: calc(env(safe-area-inset-top) + 6px) 10px calc(env(safe-area-inset-bottom) + 12px)
			max(10px, env(safe-area-inset-left));
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-left: 10px;
		margin-bottom: 12px;
	}

	header span {
		font-size: 17px;
		font-weight: 600;
	}

	ul {
		flex: 1;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li + li {
		margin-top: 2px;
	}

	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 11px 12px;
		border: 0;
		border-radius: 12px;
		background: transparent;
		font-size: 16px;
		text-align: left;
	}

	.item.current {
		background: var(--hover);
		font-weight: 600;
	}

	.settings {
		color: var(--muted);
	}

	@media (hover: hover) {
		.item:not(.current):hover {
			background: var(--hover);
		}
	}
</style>
