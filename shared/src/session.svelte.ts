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

	/**
	 * The email waiting for the code from its confirmation mail, or '' when nothing is. Neon Auth
	 * is the one that asks for it: an account it has not confirmed gets no session at all.
	 */
	confirming = $state('');

	#checking?: Promise<void>;

	/** Asks Neon Auth who this is. Runs once; `Account` waits for it before drawing anything. */
	check(): Promise<void> {
		return (this.#checking ??= this.#check());
	}

	async #check() {
		// A session that cannot be confirmed is no session: the sign-in screen it is.
		this.#adopt(await auth.getSession().catch(() => undefined));
	}

	async signIn(email: string, password: string) {
		const address = email.trim();
		await this.#attempt(() => auth.signIn(address, password), 'FAILED');
		// Neon Auth refuses an account whose email is not confirmed, and signing in does not always
		// send a new code: ask for one, so the screen that follows has something to ask for.
		if (this.errorCode === 'EMAIL_NOT_VERIFIED') await this.#confirm(address, true);
	}

	async signUp(name: string, email: string, password: string) {
		const address = email.trim();
		await this.#attempt(() => auth.signUp(name.trim(), address, password), 'SIGNED_UP');
		// The account was made but no session came with it: Neon Auth wants the email confirmed
		// first, and has just sent the code there.
		if (this.errorCode === 'SIGNED_UP') await this.#confirm(address, false);
	}

	/** The code from the confirmation mail, and the password they typed to get this far. */
	async confirm(code: string, password: string) {
		const email = this.confirming;
		this.busy = true;
		this.#fail('', '');
		try {
			const account = await auth.verifyEmail(email, code.trim());
			// Confirming does not always open a session either, so sign in right after when it did
			// not. A password that no longer works is not this screen's problem: the account is
			// confirmed, and the sign-in screen is where that gets sorted out.
			this.#adopt(account ?? (await auth.signIn(email, password).catch(() => undefined)));
			this.confirming = '';
			if (!this.account) this.#fail('CONFIRMED', '');
		} catch (thrown) {
			const failure = thrown instanceof auth.AuthError ? thrown : undefined;
			this.#fail(failure?.code ?? '', failure?.message ?? '');
		} finally {
			this.busy = false;
		}
	}

	/** Another code, for one that ran out — they are good for a few minutes only. */
	async resend() {
		this.busy = true;
		this.#fail('', '');
		try {
			await auth.sendVerificationCode(this.confirming);
			this.#fail('CODE_SENT', '');
		} catch (thrown) {
			const failure = thrown instanceof auth.AuthError ? thrown : undefined;
			this.#fail(failure?.code ?? '', failure?.message ?? '');
		} finally {
			this.busy = false;
		}
	}

	/** Back to the sign-in screen without confirming: the code can be used whenever. */
	stopConfirming() {
		this.confirming = '';
		this.#fail('', '');
	}

	async #confirm(email: string, send: boolean) {
		this.confirming = email;
		// The screen that asks for the code says what is going on: the complaint is no longer one.
		this.#fail('', '');
		if (!send) return;

		this.busy = true;
		try {
			await auth.sendVerificationCode(email);
		} catch {
			// It may refuse for having sent one a moment ago. The screen has a button to ask again.
		} finally {
			this.busy = false;
		}
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
