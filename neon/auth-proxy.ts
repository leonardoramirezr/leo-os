// A Neon Function that stands Neon Auth on the site's own domain: `auth.<domain>` answers for it.
//
// Neon Auth lives at *.neon.tech, so to a page on any other domain its session cookie is a
// third-party one, and a web app saved to the iPhone home screen drops those whatever Safari's
// settings say: signing in went through and the very next call found no session. Neon Auth cannot
// be given a domain of its own; a Neon Function can. Served from a subdomain of the site, the
// cookie Neon Auth sets comes back through here as the site's own, and the browser keeps it.
//
// It forwards and nothing else: no state, no logs of what goes through. Deployed by hand, not by
// the site's workflow — «Own domain» in README.md has the commands.
//
//   NEON_AUTH_ORIGIN  Where Neon Auth really is: https://ep-xxx.neonauth.<region>.aws.neon.tech
//   SITE_ORIGIN       The only page allowed to call it: https://<domain>
//
/**
$ neon functions deploy authproxy --src neon/auth-proxy.ts \
  --env NEON_AUTH_ORIGIN=https://ep-lively-pond-b59z8201.neonauth.c-7.us-east-2.aws.neon.tech \
  --env SITE_ORIGIN=https://leo-os.is-cool.dev
$ neon functions domains register auth.leo-os.is-cool.dev --slug authproxy --output json
**/

const upstream = (process.env.NEON_AUTH_ORIGIN ?? '').replace(/\/+$/, '');
const site = (process.env.SITE_ORIGIN ?? '').replace(/\/+$/, '');

/** Only what Neon Auth needs to know who is asking, and from where. */
const FORWARDED = ['content-type', 'authorization', 'cookie', 'user-agent', 'accept'];

/**
 * What the page gets back. `content-encoding` and `content-length` stay behind on purpose: `fetch`
 * has already decompressed the body, and passing them on would make the browser do it again.
 */
const RETURNED = ['content-type', 'location', 'set-auth-jwt', 'set-auth-token'];

const cors = {
	'access-control-allow-origin': site,
	// The whole point: the cookie has to travel, both ways.
	'access-control-allow-credentials': 'true',
	'access-control-allow-methods': 'GET, POST, OPTIONS',
	'access-control-allow-headers': 'content-type, authorization',
	// The Data API token rides in a header, which a page on another origin cannot read unless told.
	'access-control-expose-headers': 'set-auth-jwt, set-auth-token',
	'access-control-max-age': '86400',
	vary: 'Origin'
};

export default async function handler(request: Request): Promise<Response> {
	if (!upstream || !site) {
		return new Response('NEON_AUTH_ORIGIN and SITE_ORIGIN must be set.', { status: 500 });
	}
	if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

	const headers = new Headers();
	for (const name of FORWARDED) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	// Neon Auth turns away a request whose origin is not one of its trusted domains: it has to see
	// the page's, not ours.
	headers.set('origin', request.headers.get('origin') ?? site);

	const { pathname, search } = new URL(request.url);
	let answer: Response;
	try {
		answer = await fetch(`${upstream}${pathname}${search}`, {
			method: request.method,
			headers,
			body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
			// A redirect is for the browser to follow, where the cookie it may carry belongs.
			redirect: 'manual'
		});
	} catch {
		return new Response(JSON.stringify({ message: 'Neon Auth could not be reached.' }), {
			status: 502,
			headers: { ...cors, 'content-type': 'application/json' }
		});
	}

	const returned = new Headers(cors);
	for (const name of RETURNED) {
		const value = answer.headers.get(name);
		if (value) returned.set(name, value);
	}
	// Set by Neon Auth for its own host and partitioned for being a third party: here it is neither.
	// Without a Domain the cookie belongs to this host, which is the same site as the apps.
	for (const cookie of answer.headers.getSetCookie()) {
		returned.append('set-cookie', cookie.replace(/;\s*(domain=[^;]*|partitioned)(?=;|$)/gi, ''));
	}

	return new Response(answer.body, { status: answer.status, headers: returned });
}
