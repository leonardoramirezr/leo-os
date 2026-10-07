<script lang="ts">
	// The catalog to pick an exercise from, grouped as the routine it started from groups them, with
	// a search over every name each one goes by. Whatever is not in it can be added by its name alone.
	import { GROUPS, search, type Exercise } from '$lib/catalog';
	import ExerciseMedia from './ExerciseMedia.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';

	let {
		open = $bindable(),
		title = 'Añadir ejercicio',
		onpick
	}: {
		open: boolean;
		title?: string;
		/** A catalog exercise by id, or one of the user's own by name (`id` empty). */
		onpick: (id: string, name: string) => void;
	} = $props();

	let query = $state('');

	const found = $derived(search(query));
	const groups = $derived(
		GROUPS.map((group) => ({ ...group, exercises: found.filter((exercise) => exercise.group === group.id) })).filter(
			(group) => group.exercises.length
		)
	);

	// Every time it opens, it starts from the whole catalog.
	$effect(() => {
		if (open) query = '';
	});

	function pick(exercise: Exercise) {
		open = false;
		onpick(exercise.id, '');
	}

	function own() {
		const name = query.trim();
		if (!name) return;
		open = false;
		onpick('', name);
	}
</script>

<Sheet bind:open {title}>
	{#snippet leading()}
		<button class="text-button" type="button" onclick={() => (open = false)}>Cancelar</button>
	{/snippet}

	<label class="search">
		<Icon name="search" size={18} />
		<input
			type="search"
			placeholder="Buscar: sentadilla, press, chin-up…"
			aria-label="Buscar ejercicio"
			autocomplete="off"
			bind:value={query}
			onkeydown={(event) => {
				if (event.key === 'Enter' && !found.length) own();
			}}
		/>
	</label>

	{#each groups as group (group.id)}
		<h3 class="section-title"><span class="dot" style:background="var(--group-{group.id})"></span>{group.name}</h3>
		<ul class="group">
			{#each group.exercises as exercise (exercise.id)}
				<li>
					<button type="button" class="row" onclick={() => pick(exercise)}>
						<ExerciseMedia exercise={exercise.id} thumb />
						<span class="name">{exercise.name}</span>
						{#if exercise.timed}<span class="badge">por tiempo</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/each}

	{#if query.trim()}
		<h3 class="section-title">¿No está?</h3>
		<ul class="group">
			<li>
				<button type="button" class="row own" onclick={own}>
					<span class="plus"><Icon name="plus" /></span>
					<span class="name">Usar «{query.trim()}», sin animación</span>
				</button>
			</li>
		</ul>
		<p class="hint">Un ejercicio propio se guarda con su nombre; luego puedes darle un GIF o un video.</p>
	{/if}
</Sheet>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--group);
		color: var(--muted);
	}

	.search input {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		outline: none;
		background: none;
		color: var(--text);
		font-size: 17px;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 22px;
	}

	li + li {
		border-top: 1px solid var(--border);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 64px;
		padding: 8px 16px 8px 8px;
		border: 0;
		background: none;
		text-align: left;
	}

	@media (hover: hover) {
		.row:hover {
			background: var(--hover);
		}
	}

	.name {
		flex: 1;
		min-width: 0;
		font-size: 16px;
		line-height: 1.3;
	}

	.badge {
		flex: none;
		color: var(--muted);
		font-size: 13px;
	}

	.own {
		color: var(--tint);
		min-height: 52px;
		padding-left: 16px;
	}

	.plus {
		display: grid;
		place-items: center;
	}
</style>
