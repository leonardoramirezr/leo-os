<script lang="ts">
	// The workout under way, left through «back»: it goes on — its timers keep the time —, and this
	// is the way into it again.
	import { slotsOf } from '$lib/routine';
	import { resume, workout } from '$lib/workout.svelte';

	const under = $derived.by(() => {
		const session = workout.session;
		if (!workout.active || !session || !workout.day || !workout.routine) return undefined;
		const total = slotsOf(workout.day).length;
		return { routine: workout.routine.name, day: workout.day.name, done: session.sets.length, total };
	});
</script>

{#if under}
	<button class="under" type="button" onclick={resume}>
		<span class="text">
			<span class="title">Entrenamiento en curso</span>
			<span class="meta">{under.done} de {under.total} series · {under.day} · {under.routine}</span>
		</span>
		<span class="go">Continuar</span>
	</button>
{/if}

<style>
	.under {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		margin-top: 16px;
		padding: 14px 16px;
		border: 0;
		border-radius: 16px;
		background: var(--accent);
		color: #fff;
		text-align: left;
	}

	.text {
		display: flex;
		flex: 1;
		min-width: 0;
		flex-direction: column;
		gap: 2px;
	}

	.title {
		font-size: 16px;
		font-weight: 600;
	}

	.meta {
		overflow: hidden;
		font-size: 14px;
		opacity: 0.9;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.go {
		flex: none;
		padding: 8px 14px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.2);
		font-size: 15px;
		font-weight: 600;
	}
</style>
