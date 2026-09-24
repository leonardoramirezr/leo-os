// Where Neon is. Both URLs come from the Neon console and are baked into the build by
// .github/workflows/deploy.yml; neither is a secret, they are the public addresses of two services
// that decide for themselves what the caller may see.
//
// A checkout without them builds and runs: every screen says there is no database instead of
// failing to sign in.

function trim(url: string | undefined): string {
	return (url ?? '').trim().replace(/\/+$/, '');
}

/** Neon Auth, e.g. https://ep-xxx.neonauth.<region>.aws.neon.tech/<database>/auth */
export const authUrl = trim(import.meta.env.VITE_NEON_AUTH_URL);

/** The Data API, e.g. https://ep-xxx.apirest.<region>.aws.neon.tech/<database>/rest/v1 */
export const dataApiUrl = trim(import.meta.env.VITE_NEON_DATA_API_URL);

/**
 * The schema every query names. Empty on the published site, which gets the Data API's default:
 * `public`. A preview is built with its own, a copy of `public` made by `db/preview.mjs` with the
 * branch's migrations on top, so that trying it never touches the published data.
 */
export const dataApiSchema = (import.meta.env.VITE_NEON_DATA_API_SCHEMA ?? '').trim();

export const configured = Boolean(authUrl && dataApiUrl);
