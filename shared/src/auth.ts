// Neon Auth, straight over its REST API — the same endpoints `@neondatabase/neon-js` calls, minus
// the SDK, which would have pulled React and a hundred other packages into a site that has none.
//
// The session is the cookie Neon Auth sets on its own domain, which the browser holds until it
// expires (a year: it is the console that decides, see README) and sends back on every call
// because of `credentials: 'include'`. That one cookie is what makes signing in on the home screen
// enough for every app.
//
// Except where the cookie never makes it. To a page on github.io it is a third-party cookie, and
// an iPhone home screen web app drops those whatever Safari's settings say: signing in went
// through and the very next call found no session. So the session token also goes to
// localStorage, and every call carries it as a bearer, which Neon Auth takes in place of the cookie.
//
// Each answer also carries a short-lived JWT in the `set-auth-jwt` header. That, and not the
// cookie, is what the Data API is shown: `token()` hands it over and asks for a fresh one when it
// runs out.
import { authUrl } from './config';
import { logResponse } from './debug.svelte';

export interface AuthUser {
	id: string;
	email: string;
	name: string;
}

export class AuthError extends Error {
	/** Neon Auth's own code, e.g. INVALID_EMAIL_OR_PASSWORD. Empty when it never answered. */
	readonly code: string;

	constructor(message: string, code = '') {
		super(message);
		this.name = 'AuthError';
		this.code = code;
	}
}

/** Where the session token is kept, for the browsers that will not send the cookie. */
const STORED = 'leo-os:session';

function stored(): string {
	try {
		return localStorage.getItem(STORED) ?? '';
	} catch {
		// Site data blocked: the cookie is all there is.
		return '';
	}
}

function store(token: string) {
	try {
		if (token) localStorage.setItem(STORED, token);
		else localStorage.removeItem(STORED);
	} catch {
		// Same as above: without storage this browser has to make do with the cookie.
	}
}

/** The token for the Data API, with the moment it stops being good. */
let jwt = { value: '', expiresAt: 0 };

/** Asked for a little before it expires: a request must not go out with a token about to die. */
const MARGIN = 30_000;

function expiryOf(token: string): number {
	try {
		const payload: unknown = JSON.parse(atob(token.split('.')[1]));
		const exp = (payload as { exp?: unknown }).exp;
		return typeof exp === 'number' ? exp * 1000 : 0;
	} catch {
		// Not something we can read: treat it as good only for this request.
		return Date.now() + MARGIN;
	}
}

/**
 * Every answer from Neon Auth may bring a fresh token along. Reading it here is what keeps the
 * Data API working without a second round trip after signing in.
 */
function capture(response: Response) {
	const token = response.headers.get('set-auth-jwt');
	if (token) jwt = { value: token, expiresAt: expiryOf(token) };

	// A renewed session token, when Neon Auth rolls one over and lets it be read.
	const session = response.headers.get('set-auth-token');
	if (session) store(session);
}

/** Signing in and signing up hand the session token back in the body too, when there is one. */
function keepSession(answer: unknown): boolean {
	const token = (answer as { token?: unknown } | null)?.token;
	if (typeof token !== 'string' || !token) return false;

	store(token);
	return true;
}

async function call(path: string, body?: unknown): Promise<unknown> {
	const bearer = stored();
	const headers: Record<string, string> = {
		...(body === undefined ? undefined : { 'content-type': 'application/json' }),
		...(bearer ? { authorization: `Bearer ${bearer}` } : undefined)
	};

	let response: Response;
	try {
		response = await fetch(`${authUrl}${path}`, {
			method: body === undefined ? 'GET' : 'POST',
			// The session cookie belongs to Neon Auth's domain, not ours: it only travels if asked for.
			credentials: 'include',
			headers,
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		throw new AuthError('Sin conexión con Neon Auth.');
	}

	await logResponse(`auth ${path}`, response, headers);
	capture(response);

	const answer: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const failure = (answer ?? {}) as { message?: string; code?: string };
		throw new AuthError(failure.message || `Neon Auth respondió ${response.status}.`, failure.code);
	}
	return answer;
}

/** Neon Auth answers sign-in, sign-up and get-session alike with `{ user, session }`. */
function userOf(answer: unknown): AuthUser | undefined {
	const user = (answer as { user?: { id?: unknown; email?: unknown; name?: unknown } } | null)?.user;
	if (!user || typeof user.id !== 'string') return undefined;

	return {
		id: user.id,
		email: typeof user.email === 'string' ? user.email : '',
		name: typeof user.name === 'string' ? user.name : ''
	};
}

export async function getSession(): Promise<AuthUser | undefined> {
	const user = userOf(await call('/get-session'));
	// No session: whatever token is kept belongs to whoever was signed in before, or is dead.
	if (!user) {
		jwt = { value: '', expiresAt: 0 };
		store('');
	}
	return user;
}

export async function signIn(email: string, password: string): Promise<AuthUser | undefined> {
	// `rememberMe` is what makes the cookie outlive the browser session; without it the year the
	// console grants the session would not survive closing the tab.
	store('');
	const answer = await call('/sign-in/email', { email, password, rememberMe: true });
	keepSession(answer);
	return userOf(answer);
}

/**
 * Gives back the account only when signing up also opened a session. Neon Auth answers with the
 * user either way, and when the account has to be confirmed first that user has no session behind
 * it: taking it for a sign-in would put the apps in front of a Data API that refuses them, and the
 * brand new account would be told its session ran out.
 */
export async function signUp(
	name: string,
	email: string,
	password: string
): Promise<AuthUser | undefined> {
	// Whatever tokens were kept belong to whoever was here before: forget them, so that what this
	// answer may bring is the only thing that says a session was opened.
	jwt = { value: '', expiresAt: 0 };
	store('');
	const answer = await call('/sign-up/email', { name, email, password });
	const opened = keepSession(answer);
	return opened || jwt.value ? userOf(answer) : undefined;
}

export async function signOut(): Promise<void> {
	jwt = { value: '', expiresAt: 0 };
	try {
		// Still carrying the token: it is what tells Neon Auth which session to close.
		await call('/sign-out', {});
	} finally {
		store('');
	}
}

/** The token the Data API is shown. Comes from the session, and is renewed from it too. */
export async function token(): Promise<string> {
	if (jwt.value && Date.now() < jwt.expiresAt - MARGIN) return jwt.value;

	await getSession();
	if (!jwt.value) throw new AuthError('La sesión caducó.', 'NO_SESSION');
	return jwt.value;
}
