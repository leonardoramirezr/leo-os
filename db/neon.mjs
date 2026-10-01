// The Neon API, for the Data API's sake: it is where the Data API is told which schemas to serve, and
// to read the tables again after a migration — until then it answers from what it read before. It
// is also where Leogram's bucket and the key to it are made (storage.mjs).
//
// It takes NEON_API_KEY and NEON_PROJECT_ID, and finds the Data API from VITE_NEON_DATA_API_URL. They
// are read when called, not on import: the scripts load the root .env first.

/** The names of what the Neon API needs and is not set. */
export function missingForNeon() {
	const { NEON_API_KEY, NEON_PROJECT_ID, VITE_NEON_DATA_API_URL } = process.env;
	return Object.entries({ NEON_API_KEY, NEON_PROJECT_ID, NEON_DATA_API_URL: VITE_NEON_DATA_API_URL })
		.filter(([, value]) => !value)
		.map(([name]) => name);
}

export async function neon(method, path, body) {
	const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
		method,
		headers: {
			authorization: `Bearer ${process.env.NEON_API_KEY}`,
			accept: 'application/json',
			...(body && { 'content-type': 'application/json' })
		},
		body: body && JSON.stringify(body)
	});
	const text = await response.text();
	if (!response.ok) {
		const error = new Error(`The Neon API answered ${method} ${path} with ${response.status}: ${text}`);
		error.status = response.status;
		throw error;
	}
	return text ? JSON.parse(text) : {};
}

/** Where the Neon API keeps the branch the site's Data API runs on: its project and its branch. */
export async function branchPath() {
	const project = process.env.NEON_PROJECT_ID;
	// https://ep-xxx.apirest.<region>.aws.neon.tech/<database>/rest/v1
	const endpointId = new URL(process.env.VITE_NEON_DATA_API_URL).hostname.split('.')[0];
	const { endpoint } = await neon('GET', `/projects/${project}/endpoints/${endpointId}`);
	return `/projects/${project}/branches/${endpoint.branch_id}`;
}

/** Where the Neon API keeps the site's Data API: its project, its branch and its database. */
export async function dataApiPath() {
	const url = new URL(process.env.VITE_NEON_DATA_API_URL);
	const database = decodeURIComponent(url.pathname.split('/')[1] ?? '');
	return `${await branchPath()}/data-api/${encodeURIComponent(database)}`;
}

/** Has the Data API read the tables again. An empty body leaves its settings as they are. */
export async function refreshDataApi() {
	await neon('PATCH', await dataApiPath(), {});
}
