// The Neon Data API: PostgREST over HTTPS, queried straight from the browser. There is still no
// backend of ours in between — what stands between one account and another's rows are the row
// level security policies in `db/schema.sql`. The token says who is asking; Postgres decides.
//
// Only what the apps need is here: read a table whole, add rows, change them, drop them. Every
// table these apps use is small enough to read in one go.
import { AuthError, token } from './auth';
import { dataApiUrl } from './config';
import { logResponse } from './debug.svelte';

export class DbError extends Error {
	/** PostgREST's code, e.g. PGRST301 for a token that ran out. Empty when it never answered. */
	readonly code: string;

	constructor(message: string, code = '') {
		super(message);
		this.name = 'DbError';
		this.code = code;
	}
}

/**
 * True when the failure means «sign in again» rather than «that did not work». Only a bad token
 * counts: a policy that refused the row (42501) is a different problem, and throwing the user out
 * over it would hide it.
 */
export function isExpired(error: unknown): boolean {
	if (error instanceof AuthError) return error.code === 'NO_SESSION';
	return error instanceof DbError && error.code === 'PGRST301';
}

/** A PostgREST filter: `eq('id', person.id)` is `id=eq.<id>`. */
export function eq(column: string, value: string): string {
	return `${column}=eq.${encodeURIComponent(value)}`;
}

async function request(method: string, path: string, body?: unknown, prefer?: string) {
	const bearer = await token();

	let response: Response;
	try {
		response = await fetch(`${dataApiUrl}/${path}`, {
			method,
			headers: {
				authorization: `Bearer ${bearer}`,
				...(body === undefined ? undefined : { 'content-type': 'application/json' }),
				...(prefer === undefined ? undefined : { prefer })
			},
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		throw new DbError('Sin conexión con la base de datos.');
	}

	await logResponse(`data ${method} ${path}`, response, { authorization: `Bearer ${bearer.slice(0, 12)}…` });

	if (!response.ok) {
		const failure = (await response.json().catch(() => null)) as {
			message?: string;
			code?: string;
		} | null;
		throw new DbError(
			failure?.message || `La base de datos respondió ${response.status}.`,
			failure?.code || (response.status === 401 ? 'PGRST301' : '')
		);
	}
	return response;
}

/** Every row of a table this account can see. */
export async function select<T>(table: string, columns = '*'): Promise<T[]> {
	const response = await request('GET', `${table}?select=${encodeURIComponent(columns)}`);
	return (await response.json()) as T[];
}

export async function insert(table: string, rows: unknown): Promise<void> {
	await request('POST', table, rows, 'return=minimal');
}

/** Adds the rows, or replaces the ones already there. The primary key is what decides. */
export async function upsert(table: string, rows: unknown): Promise<void> {
	await request('POST', table, rows, 'return=minimal,resolution=merge-duplicates');
}

export async function update(table: string, filter: string, changes: unknown): Promise<void> {
	await request('PATCH', `${table}?${filter}`, changes, 'return=minimal');
}

export async function remove(table: string, filter: string): Promise<void> {
	await request('DELETE', `${table}?${filter}`, undefined, 'return=minimal');
}
