<script lang="ts">
	import ChatView from '$lib/components/ChatView.svelte';
	import Drawer from '$lib/components/Drawer.svelte';
	import MiniAppEditor from '$lib/components/MiniAppEditor.svelte';
	import MiniAppList from '$lib/components/MiniAppList.svelte';
	import MiniAppRunner from '$lib/components/MiniAppRunner.svelte';
	import Onboarding from '$lib/components/Onboarding.svelte';
	import SettingsSheet from '$lib/components/SettingsSheet.svelte';
	import { miniApps } from '$lib/miniapps.svelte';
	import { apiKey, place } from '$lib/settings.svelte';

	let menuOpen = $state(false);
	let settingsOpen = $state(false);
	/** The mini app being edited, `{}` for a new one. Not kept: an unsaved edit is let go. */
	let editing = $state<{ id?: string } | null>(null);

	const view = $derived(place.value?.view === 'mini-apps' ? 'mini-apps' : 'chat');
	// A mini app deleted on another device leaves its list behind.
	const app = $derived(view === 'mini-apps' ? miniApps.find(place.value.app) : undefined);

	function go(next: 'chat' | 'mini-apps', id?: string) {
		editing = null;
		place.value = { view: next, app: id };
	}

	function changeKey() {
		apiKey.value = '';
	}
</script>

{#if apiKey.value}
	{#if view === 'chat'}
		<ChatView onmenu={() => (menuOpen = true)} onsettings={() => (settingsOpen = true)} onchangekey={changeKey} />
	{:else if editing}
		<MiniAppEditor
			app={miniApps.find(editing.id)}
			onsave={(id) => go('mini-apps', id)}
			oncancel={() => (editing = null)}
			ondelete={() => go('mini-apps')}
		/>
	{:else if app}
		{#key app.id}
			<MiniAppRunner
				{app}
				onback={() => go('mini-apps')}
				onedit={() => (editing = { id: app.id })}
				onchangekey={changeKey}
			/>
		{/key}
	{:else}
		<MiniAppList
			onmenu={() => (menuOpen = true)}
			onopen={(id) => go('mini-apps', id)}
			onnew={() => (editing = {})}
		/>
	{/if}

	<Drawer bind:open={menuOpen} current={view} onselect={(next) => go(next)} onsettings={() => (settingsOpen = true)} />
	<SettingsSheet bind:open={settingsOpen} onchangekey={changeKey} />
{:else}
	<Onboarding />
{/if}
