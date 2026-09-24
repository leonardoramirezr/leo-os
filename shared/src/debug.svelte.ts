// TEMPORARY: what Neon Auth and the Data API answered, drawn under the sign-in form, to see on the
// iPhone whether the session token arrives. Remove once that is settled.

export const debugLog = $state<string[]>([]);

/** Only what the browser lets this page read: cross-origin, unexposed headers do not show up. */
export async function logResponse(label: string, response: Response, sent: Record<string, string>) {
	const headers = [...response.headers].map(([name, value]) => `  ${name}: ${value}`).join('\n');
	const body = await response
		.clone()
		.text()
		.catch((thrown) => `(unreadable: ${String(thrown)})`);
	debugLog.push(
		`${new Date().toISOString()} ${label} → ${response.status}\n` +
			`sent headers: ${Object.keys(sent).join(', ') || '(none)'}\n` +
			`headers:\n${headers || '  (none readable)'}\nbody:\n${body}`
	);
}
