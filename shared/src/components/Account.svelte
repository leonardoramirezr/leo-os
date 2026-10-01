<script lang="ts">
	// The door every app and the home screen open behind. Nothing renders until Neon Auth says who
	// this is and the app's own data has been read, so no screen ever shows another account's rows.
	//
	// The session lives in Neon Auth's cookie, shared by everything on this origin: signing in on
	// the home screen signs you into every app too.
	import { configured } from '../config';
	import { bindLocal } from '../local.svelte';
	import { session } from '../session.svelte';
	import { loadSettings } from '../settings.svelte';
	import { sync } from '../sync.svelte';
	import { applyTheme, theme } from '../theme';
	import { text, type Lang } from './text';

	let {
		children,
		load,
		lang = 'es',
		oncancel
	}: {
		children: import('svelte').Snippet;
		/** The app's own data, read once the account is known. Must not throw. */
		load?: (userId: string) => Promise<void>;
		lang?: Lang;
		/**
		 * For a door that can be left without signing in, put up in front of something anybody may
		 * see — a Leogram post, before liking it. Signing in stays the way to everything else.
		 */
		oncancel?: () => void;
	} = $props();

	const t = $derived(text[lang]);

	// Neon Auth answers in English: its code becomes a sentence in the app's language, and what it
	// said is the fallback for a failure with no code of its own.
	const problem = $derived(
		session.errorCode || session.error
			? (t.errors[session.errorCode] ?? (session.error || t.errors.FAILED))
			: ''
	);

	let mode = $state<'in' | 'up'>('in');
	let name = $state('');
	let email = $state('');
	let password = $state('');
	let code = $state('');
	let ready = $state(false);

	// Runs once per account: the settings every app shares, then whatever this app keeps of its own.
	$effect(() => {
		const account = session.account;
		if (!account) {
			ready = false;
			return;
		}

		let current = true;
		bindLocal(account.id);
		(async () => {
			await loadSettings(account.id);
			await load?.(account.id);
			if (current) ready = true;
		})();
		return () => (current = false);
	});

	// The device's until this account's settings say otherwise, which is before the app draws.
	$effect(() => applyTheme(theme.value));

	if (configured) session.check();

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (session.busy) return;

		if (session.confirming) await session.confirm(code, password);
		else if (mode === 'in') await session.signIn(email, password);
		else await session.signUp(name, email, password);

		// Asked for a code, the account exists: whenever the form is back, it is to sign in to it.
		if (session.confirming) mode = 'in';
	}

	function resend() {
		// Whatever was typed belongs to a code that no longer works.
		code = '';
		session.resendCode();
	}

	function back() {
		code = '';
		session.stopConfirming();
	}
</script>

{#if !configured}
	<div class="gate">
		<div class="card">
			<h1>{t.notConfiguredTitle}</h1>
			<p class="hint">{t.notConfigured}</p>
		</div>
	</div>
{:else if session.status === 'checking'}
	<div class="gate" aria-busy="true"></div>
{:else if session.status === 'out' && session.confirming}
	<div class="gate">
		<form class="card" onsubmit={submit}>
			<h1>{t.confirmTitle}</h1>
			<p class="hint">{t.codeFrom[session.codeFrom](session.confirming)}</p>

			<!-- iOS offers the code from Mail as soon as the email arrives: one-time-code asks it to. -->
			<input
				bind:value={code}
				class="code"
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				placeholder={t.code}
				aria-label={t.code}
				required
			/>

			{#if problem}
				<p class="hint error">{problem}</p>
			{/if}

			<button class="primary" type="submit" disabled={session.busy}>
				{session.busy ? t.working : t.confirm}
			</button>
			<button class="switch" type="button" onclick={resend} disabled={session.busy}>
				{t.resendCode}
			</button>
			<button class="switch" type="button" onclick={back} disabled={session.busy}>{t.back}</button>
		</form>
	</div>
{:else if session.status === 'out'}
	<div class="gate">
		<form class="card" onsubmit={submit}>
			<h1>{mode === 'in' ? t.signInTitle : t.signUpTitle}</h1>
			<p class="hint">{t.subtitle}</p>

			{#if mode === 'up'}
				<input
					bind:value={name}
					type="text"
					autocomplete="name"
					placeholder={t.name}
					aria-label={t.name}
					required
				/>
			{/if}
			<input
				bind:value={email}
				type="email"
				autocomplete="email"
				autocapitalize="none"
				placeholder={t.email}
				aria-label={t.email}
				required
			/>
			<input
				bind:value={password}
				type="password"
				autocomplete={mode === 'in' ? 'current-password' : 'new-password'}
				placeholder={t.password}
				aria-label={t.password}
				minlength="8"
				required
			/>

			{#if problem}
				<p class="hint error">{problem}</p>
			{/if}

			<button class="primary" type="submit" disabled={session.busy}>
				{session.busy ? t.working : mode === 'in' ? t.signIn : t.signUp}
			</button>
			<button
				class="switch"
				type="button"
				onclick={() => {
					mode = mode === 'in' ? 'up' : 'in';
					session.clearError();
				}}
			>
				{mode === 'in' ? t.toSignUp : t.toSignIn}
			</button>
			{#if oncancel}
				<button class="switch" type="button" onclick={oncancel}>{t.notNow}</button>
			{/if}
		</form>
	</div>
{:else if !ready}
	<div class="gate" aria-busy="true">
		<p class="hint">{t.loading}</p>
	</div>
{:else}
	{#if sync.error}
		<p class="banner" role="status">{sync.error}</p>
	{/if}
	{@render children()}
{/if}

<!-- What iOS 26 colours the status bar after (README.md, «Home»): the project's --status-bar, or else
     its --bg, and the door's own purple while the door is up. WebKit keeps reading the background of
     a fixed element as wide as the screen and shorter than it, like this strip; one that fills the
     screen, like the door or an app's frame, keeps whatever colour the band already had. -->
<div class="top-edge" class:door={!ready} aria-hidden="true"></div>

<style>
	/* The theme picked in the home screen's Ajustes, over the device's (theme.ts). */
	:global(:root[data-theme='light']) {
		color-scheme: light;
	}

	:global(:root[data-theme='dark']) {
		color-scheme: dark;
	}

	.gate {
		display: flex;
		position: fixed;
		inset: 0;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: linear-gradient(170deg, #4a2a8a, #1c1446);
		color: #fff;
		font-family:
			-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 12px;
		box-sizing: border-box;
		width: 100%;
		max-width: 340px;
		padding: 24px 20px;
		border-radius: 20px;
		background: #1c1c1e;
		box-shadow: 0 20px 60px rgb(0 0 0 / 0.35);
	}

	h1 {
		margin: 0;
		font-size: 22px;
		font-weight: 600;
	}

	.hint {
		margin: 0;
		color: #98989f;
		font-size: 13px;
		line-height: 1.4;
	}

	.hint.error {
		color: #ff453a;
	}

	input {
		box-sizing: border-box;
		width: 100%;
		padding: 12px 14px;
		border: 0;
		border-radius: 12px;
		background: #2c2c2e;
		color: #fff;
		font: inherit;
		font-size: 17px;
	}

	input:focus {
		outline: 2px solid #0a84ff;
		outline-offset: -2px;
	}

	.code {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.3em;
		text-align: center;
	}

	/* The placeholder is a word, not digits: spaced out like them it reads badly. */
	.code::placeholder {
		letter-spacing: normal;
	}

	button {
		padding: 12px;
		border: 0;
		border-radius: 12px;
		background: none;
		color: #0a84ff;
		font: inherit;
		font-size: 17px;
		cursor: pointer;
	}

	.primary {
		margin-top: 4px;
		background: #0a84ff;
		color: #fff;
		font-weight: 600;
	}

	.primary:disabled {
		background: #2c2c2e;
		color: #98989f;
		cursor: default;
	}

	.switch {
		padding: 4px;
		font-size: 15px;
	}

	.switch:disabled {
		color: #98989f;
		cursor: default;
	}

	/* Only there for WebKit to read, so out of sight and out of the way of every tap. A mask hides it
	   because WebKit skips what is hidden or transparent, but reads what is masked; and it is over
	   10px tall because WebKit reads no colour from anything thinner. */
	.top-edge {
		position: fixed;
		z-index: 1000;
		top: 0;
		left: 0;
		width: 100%;
		height: 12px;
		background-color: var(--status-bar, var(--bg, transparent));
		pointer-events: none;
		-webkit-mask-image: linear-gradient(transparent, transparent);
		mask-image: linear-gradient(transparent, transparent);
	}

	/* The top of the door's gradient. */
	.top-edge.door {
		background-color: #4a2a8a;
	}

	/* Above whatever the app draws: a write that did not make it has to be seen. */
	.banner {
		position: fixed;
		z-index: 100;
		top: env(safe-area-inset-top);
		right: 8px;
		left: 8px;
		margin: 8px 0 0;
		padding: 10px 14px;
		border-radius: 12px;
		background: #ff453a;
		color: #fff;
		font-family:
			-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', system-ui, sans-serif;
		font-size: 13px;
		line-height: 1.35;
		text-align: center;
	}
</style>
