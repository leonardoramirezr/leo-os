<script lang="ts">
	// The top of a profile, as a fanzine's cover: the username in big capitals over a halftone, the
	// face stuck on a starburst beside it, and how many posts there are. The account's own profile
	// and its bio, as others open it, start the same.
	import { count } from '$lib/format';
	import Avatar from './Avatar.svelte';

	let { username, avatar, posts }: { username: string; avatar: string; posts: number } = $props();

	/** The username broken after its dots and underscores, which is where its lines may end. */
	const parts = $derived(username.split(/(?<=[._])/));

	/**
	 * As big as its longest part lets it be and still fit beside the face: the capitals are about
	 * 0.44 of their size wide, and the room is some 215 pixels on a phone.
	 */
	const size = $derived(
		Math.max(30, Math.min(66, Math.floor(500 / Math.max(1, ...parts.map((part) => part.length)))))
	);
</script>

<section class="cover">
	<div class="words">
		<h1 class="display misprint" style:font-size="{size}px">
			{#each parts as part, i (i)}{part}<wbr />{/each}
		</h1>
		<span class="tag">
			<b>{count(posts)}</b>
			{posts === 1 ? 'publicación' : 'publicaciones'}
		</span>
	</div>
	<Avatar src={avatar} {username} size={132} ring />
</section>

<style>
	.cover {
		display: flex;
		position: relative;
		align-items: flex-start;
		gap: 14px;
		padding: 18px 12px 0 16px;
	}

	/* The halftone the name is printed over, in the second ink. */
	.cover::before {
		position: absolute;
		top: 8px;
		left: 0;
		width: min(62%, 280px);
		height: calc(100% - 30px);
		background-image: radial-gradient(var(--misprint) 1.6px, transparent 1.9px);
		background-size: 8px 8px;
		content: '';
		opacity: 0.55;
	}

	.words {
		display: flex;
		position: relative;
		flex: 1;
		flex-direction: column;
		align-items: flex-start;
		gap: 16px;
		min-width: 0;
		padding-top: 4px;
	}

	h1 {
		margin: 0;
		max-width: 100%;
		line-height: 0.86;
		letter-spacing: -0.02em;
		text-shadow: 4px 3px 0 var(--misprint);
		overflow-wrap: anywhere;
	}

	.tag b {
		color: var(--accent);
		font: 800 15px/1 var(--font);
	}
</style>
