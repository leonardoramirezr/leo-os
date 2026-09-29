// Who is signed in. Neon Auth keeps the session in its own cookie, shared by the home screen and
// every app on the origin: signing in once is enough for all of them.
import * as auth from './auth';
import { clearCaches } from './cache';

export type Account = auth.AuthUser;

class Session {
	/** `checking` until Neon Auth answers on startup; from then on it is one or the other. */
	status = $state<'checking' | 'in' | 'out'>('checking');
	account = $state<Account | undefined>();

	/**
	 * The email whose code the sign-in screen is asking for; empty while it asks for none. An
	 * account whose email is not confirmed gets no session: not on signing up, and not on signing
	 * in either, until the code Neon Auth emailed it comes back.
	 */
	confirming = $state('');
	/**
	 * What sent the code being asked for. Signing up always sends one; signing in only does if the
	 * console says so; and asking for another leaves the ones before it useless.
	 */
	codeFrom = $state<'up' | 'in' | 'again'>('up');

	/**
	 * Why the last sign-in did not go through: Neon Auth's own code, which the sign-in screen
	 * turns into a sentence in the app's language, and the message it came with as a fallback.
	 */
	errorCode = $state('');
	error = $state('');
	busy = $state(false);

	#checking?: Promise<void>;

	/** Asks Neon Auth who this is. Runs once; `Account` waits for it before drawing anything. */
	check(): Promise<void> {
		return (this.#checking ??= this.#check());
	}

	async #check() {
		// A session that cannot be confirmed is no session: the sign-in screen it is.
		this.#adopt(await auth.getSession().catch(() => undefined));
	}

	signIn(email: string, password: string): Promise<void> {
		return this.#attempt(() => this.#signIn(email.trim(), password));
	}

	signUp(name: string, email: string, password: string): Promise<void> {
		email = email.trim();
		return this.#attempt(async () => {
			// Neon Auth took it but gave nothing back: ask it again rather than guess.
			this.#adopt((await auth.signUp(name.trim(), email, password)) ?? (await auth.getSession()));
			// Still no session: the email has to be confirmed first, with the code just sent to it.
			if (!this.account) this.#ask(email, 'up');
		});
	}

	/**
	 * The code from the email. Whether confirming it opens a session is the console's call; when
	 * it does not, the password typed a moment ago signs in.
	 */
	confirm(code: string, password: string): Promise<void> {
		const email = this.confirming;
		return this.#attempt(async () => {
			// Copied out of the email, it may come with spaces in it.
			const account = await auth.confirmEmail(email, code.replace(/\s/g, ''));
			// Confirmed: from here on signing in needs no code, whatever comes of it.
			this.confirming = '';
			if (account) this.#adopt(account);
			else await this.#signIn(email, password);
		});
	}

	resendCode(): Promise<void> {
		const email = this.confirming;
		return this.#attempt(async () => {
			await auth.sendCode(email);
			this.codeFrom = 'again';
		});
	}

	/** Leaves the code for later: signing in again is what asks for it. */
	stopConfirming() {
		this.confirming = '';
		this.#fail('', '');
	}

	async signOut() {
		this.busy = true;
		try {
			await auth.signOut();
		} catch {
			// The cookie may outlive this. Nothing of theirs is left on the device either way.
		} finally {
			clearCaches();
			// Every app's state was built for the account that is leaving: start the next one clean.
			location.reload();
		}
	}

	/** The session ran out or was rejected mid-use: back to the sign-in screen. */
	expire() {
		if (this.status !== 'in') return;

		this.#adopt(undefined);
		this.#fail('SESSION_EXPIRED', '');
	}

	async #signIn(email: string, password: string) {
		try {
			// Neon Auth took it but gave nothing back: ask it again rather than guess.
			this.#adopt((await auth.signIn(email, password)) ?? (await auth.getSession()));
			if (!this.account) this.#fail('FAILED', '');
		} catch (thrown) {
			// Only the right password hears this: all that is missing is the code sent to the email.
			if (!(thrown instanceof auth.AuthError) || thrown.code !== 'EMAIL_NOT_VERIFIED') throw thrown;
			this.#ask(email, 'in');
		}
	}

	/** One exchange with Neon Auth. Whatever it throws is what the screen complains about. */
	async #attempt(run: () => Promise<void>) {
		this.busy = true;
		this.#fail('', '');
		try {
			await run();
		} catch (thrown) {
			// With no code — no connection, say — the message it came with is all there is to show.
			const failure = thrown instanceof auth.AuthError ? thrown : undefined;
			this.#fail(failure?.code ?? '', failure?.message ?? '');
		} finally {
			this.busy = false;
		}
	}

	#ask(email: string, from: 'up' | 'in') {
		this.confirming = email;
		this.codeFrom = from;
	}

	/** Called when the sign-in screen changes shape: the last complaint is no longer about this. */
	clearError() {
		this.#fail('', '');
	}

	#fail(code: string, message: string) {
		this.errorCode = code;
		this.error = message;
	}

	#adopt(account: Account | undefined) {
		this.account = account;
		this.status = account ? 'in' : 'out';
	}
}

export const session = new Session();
