<script lang="ts">
	import { onMount } from 'svelte';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import DescribeView from '$lib/components/DescribeView.svelte';
	import EditorView from '$lib/components/EditorView.svelte';
	import ImportView from '$lib/components/ImportView.svelte';
	import RoutinesView from '$lib/components/RoutinesView.svelte';
	import RoutineView from '$lib/components/RoutineView.svelte';
	import StatsView from '$lib/components/StatsView.svelte';
	import WorkoutView from '$lib/components/WorkoutView.svelte';
	import { routines } from '$lib/routines.svelte';
	import { workout } from '$lib/workout.svelte';

	// The screen showing lives in the history entry (SvelteKit's shallow routing), so the back button
	// and the back gesture walk back through the screens. A reload lands on the list of routines…
	const routine = $derived(routines.find(page.state.routine));

	// …unless a workout is under way: iOS reloads a page it dropped in the background, in the middle
	// of a rest as often as not, and the way back is straight into it, with the routine behind.
	onMount(() => {
		const session = workout.session;
		if (!workout.active || !session || page.state.workout) return;
		pushState('', { routine: session.routineId });
		pushState('', { routine: session.routineId, workout: true });
	});
</script>

{#if page.state.workout && workout.session}
	<WorkoutView />
{:else if page.state.import}
	<ImportView />
{:else if page.state.describe}
	<DescribeView />
{:else if page.state.edit}
	{#key routine?.id}
		<EditorView {routine} />
	{/key}
{:else if routine && page.state.stats}
	<StatsView {routine} />
{:else if routine}
	<RoutineView {routine} />
{:else if !routines.list.length}
	<!-- The first time: straight to naming a routine and picking each day's exercises. -->
	<EditorView first />
{:else}
	<RoutinesView />
{/if}
