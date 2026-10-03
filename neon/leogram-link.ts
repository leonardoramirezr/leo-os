// A Neon Function that gives each Leogram post's link a preview of its own in a chat: its photo, who
// posted it and the caption, the way an Instagram link shows its post.
//
// WhatsApp, Telegram, Messages, Slack and the rest draw that preview from the page a link leads to,
// from its og: tags, without running any of the page. Every post opens on the same static page
// (`leogram/?p=<code>`, on GitHub Pages), so every link showed Leogram's name and nothing of the
// post. A post's link leads here instead, to `/p/<code>`, and what it gets depends on who asks:
//
//   - whoever draws previews gets a page of the post's own tags, with its picture, the post's
//     `card`, from here too (`/p/<code>.jpg`): the bucket's address for it runs out in a day or two,
//     and a chat that fetches the picture again later still finds it;
//   - anybody else is somebody opening the link, and is sent straight on to the post, with nothing
//     read first.
//
// It reads the post the way anybody with the link does: with the anonymous token Neon Auth hands
// out, through `leogram_card()`, which only ever gives away the one post whose code it is given
// (db/migrations/0010_leogram_card_public.sql). It holds no key and keeps nothing but that token,
// until it runs out. Deployed by hand, like auth-proxy.ts: «Leogram's links» in README.md has the
// commands.
//
//   SITE_URL           Where the site is: https://<domain>, or https://<owner>.github.io/<repo>
//   NEON_AUTH_URL      Neon Auth, …/<database>/auth. Unset, the branch's own: NEON_AUTH_BASE_URL
//   NEON_DATA_API_URL  The Data API, …/<database>/rest/v1. Neon sets it to the branch's own
/**
$ neon functions deploy leogramlink --src neon/leogram-link.ts --env SITE_URL=https://leo-os.is-cool.dev
$ neon functions domains register leogram.leo-os.is-cool.dev --slug leogramlink --output json
**/

const trim = (url: string | undefined) => (url ?? '').trim().replace(/\/+$/, '');

const site = trim(process.env.SITE_URL);
const authUrl = trim(process.env.NEON_AUTH_URL || process.env.NEON_AUTH_BASE_URL);
const dataApiUrl = trim(process.env.NEON_DATA_API_URL);

/** The app's folder in the site. */
const APP = 'leogram';

/**
 * `/p/<code>`, and its picture at `/p/<code>.jpg`. A preview's build puts its own path in front,
 * `/previews/<preview>` (deploy.yml), to read the preview's copy of the database.
 */
const ROUTE = /^(?:\/previews\/([a-z0-9]+(?:-[a-z0-9]+)*))?\/p\/([A-Za-z0-9_-]{11})(?:(\.jpg)|\/?)$/;

/**
 * Who reads a link to draw its preview, by the name it gives. Most say who they are; Messages, on
 * the iPhone and the Mac, passes itself off as Facebook's, and Signal as WhatsApp. Any other crawler
 * goes by the words crawlers use, «bot» among them only on its own or ending a name with a version
 * after it (Googlebot/2.1): CUBOT makes phones, and their browser says so.
 */
const PREVIEWERS =
	/facebookexternalhit|facebot|whatsapp|telegrambot|slackbot|discordbot|skypeuripreview|preview|cardyb|mastodon|embedly|iframely|vkshare|kakaotalk-scrap|google-pagerenderer|[a-z]bot\/|(?:^|[^a-z])bot\b|crawler|spider/i;

/** Every browser's name starts with this; a library, or a server asking for a preview, does not. */
const isPreviewer = (agent: string) => !agent.startsWith('Mozilla/') || PREVIEWERS.test(agent);

/** Instagram's shapes, as width over height (apps/leogram/src/lib/images.ts). */
const ASPECTS = { square: 1, portrait: 4 / 5, landscape: 1.91 } as const;

/** How wide a card always is (`linkCard` in apps/leogram/src/lib/images.ts). */
const CARD_WIDTH = 720;

/** What `leogram_card()` says of a post. */
interface Card {
	username: string;
	caption: string;
	aspect: keyof typeof ASPECTS;
	/** Epoch milliseconds. */
	created_at: number;
	likes: number;
	comments: number;
	/** Its picture: the card, or for a post from before cards, slot 0 when light or the thumbnail. */
	image: { kind: 'card' | 'photo' | 'poster' | 'thumb'; url: string | null } | null;
}

/**
 * How long Neon is waited on. A chat gives up on a preview within seconds, and Leogram's own tags in
 * time are better than the post's too late.
 */
const PATIENCE = 4_000;

/** The token for whoever is not signed in, kept until it runs out. */
let anonymous = { value: '', expiresAt: 0 };

function expiryOf(token: string): number {
	try {
		const payload: unknown = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
		const exp = (payload as { exp?: unknown }).exp;
		return typeof exp === 'number' ? exp * 1000 : 0;
	} catch {
		return 0;
	}
}

/** The anonymous token Neon Auth hands anybody, which the Data API runs as `anonymous`. */
async function anonymousToken(fresh: boolean): Promise<string> {
	if (!fresh && Date.now() < anonymous.expiresAt - 30_000) return anonymous.value;

	const response = await fetch(`${authUrl}/token/anonymous`, {
		// The site's origin, one of Neon Auth's trusted domains: it is the site asking, after all.
		headers: { accept: 'application/json', origin: new URL(site).origin },
		signal: AbortSignal.timeout(PATIENCE)
	});
	const answer = (await response.json().catch(() => null)) as { token?: unknown } | null;
	const value = response.ok && typeof answer?.token === 'string' ? answer.token : '';
	anonymous = { value, expiresAt: value ? expiryOf(value) : 0 };
	return value;
}

/** The schema a preview's copy of the database is in, named as db/preview.mjs names it. */
const schemaOf = (preview: string) => `preview_${preview.replaceAll('-', '_')}`.slice(0, 63).replace(/_+$/, '');

/** The post, or null when there is none with that code. Throws when it could not be asked. */
async function readCard(code: string, preview: string | undefined): Promise<Card | null> {
	if (!authUrl || !dataApiUrl) throw new Error('Where Neon Auth and the Data API are is not set.');

	for (const fresh of [false, true]) {
		const token = await anonymousToken(fresh);
		const response = await fetch(`${dataApiUrl}/rpc/leogram_card`, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
				...(token && { authorization: `Bearer ${token}` }),
				...(preview && { 'content-profile': schemaOf(preview) })
			},
			body: JSON.stringify({ code }),
			signal: AbortSignal.timeout(PATIENCE)
		});
		// A token that ran out before its time is asked for again, once.
		if (response.status === 401 && !fresh) continue;
		if (!response.ok) throw new Error(`The Data API answered ${response.status}.`);

		// A function of one value comes back as that value; or as a row named after the function.
		const answer: unknown = await response.json();
		const row: unknown = Array.isArray(answer) && answer.length === 1 ? answer[0] : answer;
		const named = row !== null && typeof row === 'object' && 'leogram_card' in row;
		return ((named ? (row as { leogram_card: unknown }).leogram_card : row) ?? null) as Card | null;
	}
	throw new Error('The Data API turned the anonymous token away.');
}

const COUNT = new Intl.NumberFormat('es-MX');

// Leo OS speaks Mexico's Spanish, and a page read by a server knows nobody's time zone: Mexico's.
const DATE = new Intl.DateTimeFormat('es-MX', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'America/Mexico_City'
});

const GRAPHEMES = new Intl.Segmenter('es', { granularity: 'grapheme' });

/** On one line, and cut at `most` characters, never through the middle of an emoji. */
function clip(text: string, most: number): string {
	const line = text.replace(/\s+/g, ' ').trim();
	const characters = Array.from(GRAPHEMES.segment(line), ({ segment }) => segment);
	return characters.length <= most ? line : `${characters.slice(0, most - 1).join('').trimEnd()}…`;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

interface Page {
	title: string;
	description: string;
	/** The link itself, which a chat shows and goes back to. */
	link: string;
	/** Where the post opens. */
	post: string;
	icon: string;
	image?: string;
	size?: { width: number; height: number };
	published?: number;
}

/**
 * The page a chat draws the preview from. Nobody else is meant to see it, but should a person be
 * taken for a chat, it shows the post's picture and the way on to it.
 */
function render({ title, description, link, post, icon, image, size, published }: Page): string {
	const meta = (key: string, name: string, content: string | number) =>
		`<meta ${key}="${name}" content="${escapeHtml(String(content))}">`;
	const tags = [
		meta('name', 'description', description),
		meta('property', 'og:site_name', 'Leogram'),
		meta('property', 'og:locale', 'es_MX'),
		meta('property', 'og:type', 'article'),
		meta('property', 'og:url', link),
		meta('property', 'og:title', title),
		meta('property', 'og:description', description),
		...(image ? [meta('property', 'og:image', image), meta('property', 'og:image:type', 'image/jpeg')] : []),
		...(size
			? [meta('property', 'og:image:width', size.width), meta('property', 'og:image:height', size.height)]
			: []),
		...(published ? [meta('property', 'article:published_time', new Date(published).toISOString())] : []),
		meta('name', 'twitter:card', image ? 'summary_large_image' : 'summary'),
		// The colour Discord draws the preview's edge in: the purple of Leogram's icon.
		meta('name', 'theme-color', '#c33cbe')
	];

	return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
${tags.join('\n')}
<link rel="canonical" href="${escapeHtml(link)}">
<link rel="apple-touch-icon" href="${escapeHtml(icon)}">
<style>
	:root { color-scheme: light dark; font-family: -apple-system, system-ui, sans-serif; }
	body { margin: 0; background: Canvas; color: CanvasText; }
	main { max-width: 470px; margin: 0 auto; padding: 24px 16px; text-align: center; }
	img { display: block; width: 100%; height: auto; border-radius: 8px; }
	h1 { margin: 16px 0 8px; font-size: 18px; line-height: 24px; overflow-wrap: anywhere; }
	p { margin: 0 0 20px; color: GrayText; overflow-wrap: anywhere; }
	a { display: inline-block; padding: 10px 20px; border-radius: 8px; background: #0095f6; color: #fff;
		font-weight: 600; text-decoration: none; }
</style>
</head>
<body>
<main>
${image ? `<img src="${escapeHtml(image)}" alt="">` : ''}
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<a href="${escapeHtml(post)}">Ver en Leogram</a>
</main>
</body>
</html>
`;
}

/** The post's tags, in the words Instagram gives its own, in Spanish. */
function describe(card: Card): Pick<Page, 'title' | 'description'> {
	const caption = card.caption.trim();
	const comments = `${COUNT.format(card.comments)} ${card.comments === 1 ? 'comentario' : 'comentarios'}`;
	const posted = `${card.username} el ${DATE.format(card.created_at)}`;
	return {
		title: caption ? `${card.username} en Leogram: «${clip(caption, 100)}»` : `${card.username} en Leogram`,
		description:
			`${COUNT.format(card.likes)} Me gusta, ${comments} - ${posted}` +
			(caption ? `: «${clip(caption, 200)}»` : '')
	};
}

/** This function's own address, as whoever asked reached it: always over HTTPS. */
function ownOrigin(request: Request): string {
	const forwarded = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
	const host = forwarded && /^[a-z0-9.-]+(:\d+)?$/i.test(forwarded) ? forwarded : new URL(request.url).host;
	return `https://${host}`;
}

function redirect(location: string): Response {
	return new Response(null, {
		status: 302,
		// What a link gets depends on who asks: a cache must keep each answer to its own.
		headers: { location, 'cache-control': 'private, max-age=3600', vary: 'user-agent' }
	});
}

/** The post's picture, from the bucket, for as long as the post is there. */
async function picture(request: Request, code: string, preview: string | undefined): Promise<Response> {
	let card: Card | null;
	try {
		card = await readCard(code, preview);
	} catch {
		return new Response(null, { status: 503, headers: { 'retry-after': '60', 'cache-control': 'no-store' } });
	}
	const url = card?.image?.url;
	if (!url) return new Response(null, { status: 404, headers: { 'cache-control': 'public, max-age=300' } });

	let file: Response;
	try {
		file = await fetch(url, { signal: AbortSignal.timeout(PATIENCE * 2) });
	} catch {
		return new Response(null, { status: 504, headers: { 'cache-control': 'no-store' } });
	}
	if (!file.ok || !file.body) {
		return new Response(null, { status: 502, headers: { 'cache-control': 'no-store' } });
	}

	const headers = new Headers({
		'content-type': file.headers.get('content-type') ?? 'image/jpeg',
		'cache-control': 'public, max-age=3600'
	});
	// Only when it came as it was: `fetch` has already undone any compression.
	const length = file.headers.get('content-length');
	if (length && !file.headers.has('content-encoding')) headers.set('content-length', length);

	if (request.method === 'HEAD') {
		await file.body.cancel();
		return new Response(null, { headers });
	}
	return new Response(file.body, { headers });
}

export default async function handler(request: Request): Promise<Response> {
	if (!site) return new Response('SITE_URL must be set.', { status: 500 });
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
	}

	const { pathname } = new URL(request.url);
	if (pathname === '/') return redirect(`${site}/${APP}/`);

	const route = ROUTE.exec(pathname);
	if (!route) return new Response('Not found.', { status: 404 });
	const [, preview, code, jpg] = route;
	if (jpg) return picture(request, code, preview);

	const at = `${site}${preview ? `/previews/${preview}` : ''}/${APP}`;
	const post = `${at}/?p=${code}`;
	if (!isPreviewer(request.headers.get('user-agent') ?? '')) return redirect(post);

	const self = `${ownOrigin(request)}${preview ? `/previews/${preview}` : ''}/p/${code}`;
	const page: Page = {
		title: 'Leogram',
		description: 'Una publicación en Leogram.',
		link: self,
		post,
		icon: `${at}/apple-touch-icon.png`
	};

	let card: Card | null | undefined;
	try {
		card = await readCard(code, preview);
	} catch {
		// Neon could not be asked: Leogram's own tags, as before there was this, and none kept.
		card = undefined;
	}

	if (card === null) page.description = 'Esta publicación no está disponible.';
	if (card) {
		Object.assign(page, describe(card), { published: card.created_at || undefined });
		if (card.image?.url) {
			page.image = `${self}.jpg`;
			if (card.image.kind === 'card') {
				page.size = { width: CARD_WIDTH, height: Math.round(CARD_WIDTH / ASPECTS[card.aspect]) };
			}
		}
	}

	const html = request.method === 'HEAD' ? null : render(page);
	return new Response(html, {
		status: card === null ? 404 : 200,
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': card === undefined ? 'no-store' : 'public, max-age=300',
			vary: 'user-agent',
			// A post is for whoever has its link: no search engine lists it.
			'x-robots-tag': 'noindex'
		}
	});
}
