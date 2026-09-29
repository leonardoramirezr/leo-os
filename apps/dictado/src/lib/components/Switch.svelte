<script lang="ts">
	// An iOS switch. The real checkbox stays, on top and unseen, for taps, keyboards and screen
	// readers; what is seen is drawn under it. It is not a label of its own, so that a whole row can be.
	let { checked = $bindable(), label }: { checked: boolean; label?: string } = $props();
</script>

<span class="switch">
	<input type="checkbox" role="switch" bind:checked aria-label={label} />
	<span class="track" aria-hidden="true"></span>
</span>

<style>
	.switch {
		position: relative;
		display: inline-flex;
		flex: none;
		width: 51px;
		height: 31px;
	}

	input {
		position: absolute;
		inset: 0;
		z-index: 1;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.track {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 16px;
		background: color-mix(in srgb, var(--text) 16%, transparent);
		transition: background 0.2s;
	}

	.track::after {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 27px;
		height: 27px;
		border-radius: 50%;
		background: #fff;
		box-shadow:
			0 3px 8px rgb(0 0 0 / 0.15),
			0 1px 1px rgb(0 0 0 / 0.16);
		content: '';
		transition: transform 0.2s;
	}

	input:checked + .track {
		background: var(--accent);
	}

	input:checked + .track::after {
		transform: translateX(20px);
	}

	input:focus-visible + .track {
		outline: 2px solid var(--link);
		outline-offset: 2px;
	}
</style>
