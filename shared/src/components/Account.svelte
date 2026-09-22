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
	import { notices, text, type Lang } from './text';

	let {
		children,
		load,
		lang = 'es'
	}: {
		children: import('svelte').Snippet;
		/** The app's own data, read once the account is known. Must not throw. */
		load?: (userId: string) => Promise<void>;
		lang?: Lang;
	} = $props();

	const t = $derived(text[lang]);

	// Neon Auth answers in English: its code becomes a sentence in the app's language, and what it
	// said is the fallback for a failure with no code of its own.
	const problem = $derived(
		session.errorCode || session.error
			? (t.errors[session.errorCode] ?? (session.error || t.errors.FAILED))
			: ''
	);

	// «Te enviamos otro código» is not a complaint and is not drawn in red.
	const good = $derived(notices.includes(session.errorCode));

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

	if (configured) session.check();

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (session.busy) return;

		if (mode === 'in') session.signIn(email, password);
		else session.signUp(name, email, password);
	}

	function confirm(event: SubmitEvent) {
		event.preventDefault();
		if (session.busy) return;

		// The password from the form above: confirming the account does not always sign you in.
		session.confirm(code, password);
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
		<form class="card" onsubmit={confirm}>
			<h1>{t.confirmTitle}</h1>
			<p class="hint">{t.confirmHint.replace('{email}', session.confirming)}</p>

			<input
				bind:value={code}
				type="text"
				inputmode="numeric"
				autocomplete="one-time-code"
				autocapitalize="none"
				placeholder={t.code}
				aria-label={t.code}
				required
			/>

			{#if problem}
				<p class="hint" class:error={!good}>{problem}</p>
			{/if}

			<button class="primary" type="submit" disabled={session.busy}>
				{session.busy ? t.working : t.confirm}
			</button>
			<button class="switch" type="button" disabled={session.busy} onclick={() => session.resend()}>
				{t.resend}
			</button>
			<button
				class="switch"
				type="button"
				onclick={() => {
					code = '';
					session.stopConfirming();
				}}
			>
				{t.back}
			</button>
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
				<p class="hint" class:error={!good}>{problem}</p>
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

<style>
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
