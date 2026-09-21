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
		return this.#attempt(() => auth.signIn(email.trim(), password), 'FAILED');
	}

	signUp(name: string, email: string, password: string): Promise<void> {
		return this.#attempt(() => auth.signUp(name.trim(), email.trim(), password), 'SIGNED_UP');
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

	async #attempt(run: () => Promise<Account | undefined>, orElse: string) {
		this.busy = true;
		this.#fail('', '');
		try {
			const account = await run();
			// Neon Auth took it but gave nothing back: ask it again rather than guess.
			this.#adopt(account ?? (await auth.getSession()));
			// Signing up does not always sign you in — the account may have to be confirmed first.
			if (!this.account) this.#fail(orElse, '');
		} catch (thrown) {
			// With no code — no connection, say — the message it came with is all there is to show.
			const failure = thrown instanceof auth.AuthError ? thrown : undefined;
			this.#fail(failure?.code ?? '', failure?.message ?? '');
		} finally {
			this.busy = false;
		}
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
