// The bucket's own API, the S3 one, for what the Neon API does not do: set its CORS rules, list its
// files and delete them. Requests carry AWS Signature Version 4 in their headers, made with the same
// key the database signs the browser's addresses with (0007_leogram_public.sql). Path-style, as Neon
// wants it: the bucket goes in the path, never in the host.
import { createHash, createHmac } from 'node:crypto';

/** A refusal from the bucket. `status` is the HTTP one; `code` is S3's, e.g. `SignatureDoesNotMatch`. */
export class S3Error extends Error {
	constructor(message, status, code) {
		super(message);
		this.name = 'S3Error';
		this.status = status;
		this.code = code;
	}
}

/** RFC 3986 as Signature Version 4 wants it: only letters, digits and `-_.~` stay as they are. */
function encode(text) {
	return encodeURIComponent(text).replace(
		/[!'()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
	);
}

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/**
 * Signs a request to `bucket` — `{ endpoint, region, key_id, secret }` — and gives back the address
 * and the headers to send it with. `path` is `/<bucket>` or `/<bucket>/<key>`, already encoded; `at`
 * is there for testing.
 */
export function signRequest(bucket, method, path, options = {}) {
	const { query = {}, body = '', headers = {}, at = new Date() } = options;
	const { origin, host } = new URL(bucket.endpoint);
	const stamp = at.toISOString().replace(/[-:]|\.\d{3}/g, '');
	const day = stamp.slice(0, 8);
	const scope = `${day}/${bucket.region}/s3/aws4_request`;

	const all = { ...headers, host, 'x-amz-content-sha256': sha256(body), 'x-amz-date': stamp };
	const names = Object.keys(all).sort();
	const search = Object.keys(query)
		.sort()
		.map((name) => `${encode(name)}=${encode(query[name])}`)
		.join('&');
	const request = [
		method,
		path,
		search,
		...names.map((name) => `${name}:${String(all[name]).trim()}`),
		'',
		names.join(';'),
		all['x-amz-content-sha256']
	].join('\n');

	let key = `AWS4${bucket.secret}`;
	for (const part of [day, bucket.region, 's3', 'aws4_request']) key = hmac(key, part);
	const signature = createHmac('sha256', key)
		.update(['AWS4-HMAC-SHA256', stamp, scope, sha256(request)].join('\n'))
		.digest('hex');

	// The host goes out on its own, from the address.
	delete all.host;
	return {
		url: `${origin}${path}${search ? `?${search}` : ''}`,
		headers: {
			...all,
			authorization:
				`AWS4-HMAC-SHA256 Credential=${bucket.key_id}/${scope}, ` +
				`SignedHeaders=${names.join(';')}, Signature=${signature}`
		}
	};
}

async function s3(bucket, method, path, options = {}) {
	const { url, headers } = signRequest(bucket, method, path, options);
	let response;
	try {
		response = await fetch(url, { method, headers, body: options.body || undefined });
	} catch (error) {
		throw new S3Error(`The bucket did not answer ${method} ${path}: ${error.message}`, 0, '');
	}
	if (!response.ok) {
		const code = /<Code>([^<]*)<\/Code>/.exec(await response.text())?.[1] ?? '';
		const said = `The bucket answered ${method} ${path} with ${response.status}${code ? ` (${code})` : ''}`;
		throw new S3Error(said, response.status, code);
	}
	return response;
}

/**
 * Its CORS rules: pages may read, upload and delete, wherever they are served from. That is no
 * wider than it sounds: the bucket is private, so nothing gets through without an address the
 * database signed, and those only go to Leo Partī's own pages. Any origin is what lets `pnpm dev`
 * upload too, a phone's included, over the local network.
 */
const CORS =
	'<?xml version="1.0" encoding="UTF-8"?>' +
	'<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><CORSRule>' +
	'<AllowedOrigin>*</AllowedOrigin>' +
	['GET', 'HEAD', 'PUT', 'DELETE'].map((method) => `<AllowedMethod>${method}</AllowedMethod>`).join('') +
	'<AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds>' +
	'</CORSRule></CORSConfiguration>';

export async function putCors(bucket) {
	await s3(bucket, 'PUT', `/${encode(bucket.name)}`, {
		query: { cors: '' },
		body: CORS,
		headers: {
			// S3 takes no CORS rules without it.
			'content-md5': createHash('md5').update(CORS).digest('base64'),
			'content-type': 'application/xml'
		}
	});
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** The text of the first `<name>` in `xml`, unescaped. */
function field(xml, name) {
	const text = new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1] ?? '';
	return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, name) =>
		name[0] === '#'
			? String.fromCodePoint(Number(name[1] === 'x' ? `0${name.slice(1)}` : name.slice(1)))
			: (ENTITIES[name] ?? entity)
	);
}

/** Every file in the bucket, and when it was written. */
export async function listObjects(bucket) {
	const found = [];
	let token = '';
	do {
		const query = { 'list-type': '2', 'max-keys': '1000', ...(token && { 'continuation-token': token }) };
		const xml = await (await s3(bucket, 'GET', `/${encode(bucket.name)}`, { query })).text();
		for (const [, item] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
			found.push({ key: field(item, 'Key'), written: new Date(field(item, 'LastModified')) });
		}
		token = field(xml, 'IsTruncated') === 'true' ? field(xml, 'NextContinuationToken') : '';
	} while (token);
	return found;
}

export async function deleteObject(bucket, key) {
	await s3(bucket, 'DELETE', `/${encode(bucket.name)}/${key.split('/').map(encode).join('/')}`);
}
