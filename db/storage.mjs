// Gets Leo Partī's bucket ready, and hands the database the key it signs with.
//
//   node storage.mjs
//
// Leo Partī keeps photos, videos and songs in a bucket of the Neon project's Object Storage, and the
// browser reaches them through addresses the database signs (0007_leogram_public.sql). For that the
// database needs where the bucket is and a key to sign with, in `leogram_private.bucket`, which the
// Data API never serves. `deploy.yml` runs this on every push, after the migrations, and
// `preview-cleanup.yml` once a preview's schema is dropped. Each run:
//
//   - makes the bucket, private, if it is not there: LEOGRAM_BUCKET names it, `leogram` if unset;
//   - picks the key: LEOGRAM_STORAGE_ACCESS_KEY_ID and LEOGRAM_STORAGE_SECRET_ACCESS_KEY when both
//     are set, and otherwise a credential of its own, `leo-os-leogram`, made on the first run. The
//     Neon API shows a credential's secret only once: when the database lacks it, or it stopped
//     working, the credential is given a new one;
//   - sets the bucket's CORS rules, which let the pages upload and delete (bucket.mjs);
//   - deletes the files nothing points to any more (`sweep`);
//   - and tries what a browser does, with addresses the database signs (`tryOut`): what it says is
//     what Leo Partī can do.
//
// It needs what preview.mjs needs: DATABASE_URL, NEON_API_KEY, NEON_PROJECT_ID, and
// VITE_NEON_DATA_API_URL, whose branch is the one the bucket is made on. Without them it says so.

import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { deleteObject, listObjects, putCors, S3Error } from './bucket.mjs';
import { branchPath, missingForNeon, neon } from './neon.mjs';

// The same .env at the root that migrate.mjs reads. In GitHub Actions there is no file, and the
// values come from the repository's secrets and variables.
try {
	process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
	// No .env: whatever the environment already carries is what there is.
}

const BUCKET = process.env.LEOGRAM_BUCKET || 'leogram';
const CREDENTIAL = 'leo-os-leogram';

/** The keys the site writes: under `public/`, or under a preview's schema. Nothing else is touched. */
const OURS = /^(public|preview_[a-z0-9_]+)\//;

const HOUR = 60 * 60 * 1000;

const missing = [...(process.env.DATABASE_URL ? [] : ['DATABASE_URL']), ...missingForNeon()];
if (missing.length > 0) {
	console.log(`\n▸ Without ${missing.join(', ')}, Leo Partī's bucket is not set up: Leo Partī cannot upload.\n`);
	console.log('  «Leo Partī» in README.md says what it takes.\n');
	process.exit(0);
}

if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(BUCKET)) {
	console.error(`\n✖ LEOGRAM_BUCKET is «${BUCKET}»: a bucket's name is 3 to 63 lowercase letters, digits,`);
	console.error('  dots and dashes.\n');
	process.exit(1);
}

/** The list in an answer of the Neon API, whether it comes bare or under `name`. */
function listOf(answer, name) {
	if (Array.isArray(answer)) return answer;
	return Array.isArray(answer?.[name]) ? answer[name] : [];
}

/** The key in what the Neon API answered on making a credential or giving it a new secret. */
function keyOf(answer, token = '') {
	const credential = answer.credential ?? answer;
	const key_id = credential.token_id ?? token;
	const secret = credential.s3_secret_access_key;
	if (!key_id || !secret) {
		throw new Error(`The Neon API gave no key, only: ${Object.keys(credential).join(', ')}`);
	}
	return { key_id, secret, token: key_id, fresh: true };
}

async function renew(branch, token) {
	const answer = await neon('POST', `${branch}/credentials/${encodeURIComponent(token)}/rotate`);
	console.log(`  ✔ Gave ${CREDENTIAL} a new secret, which the database keeps`);
	return keyOf(answer, token);
}

/**
 * The key to sign with. `token` is the credential's when it is ours to give a new secret; `fresh`,
 * that it was made just now.
 */
async function pickKey(branch, stored) {
	const given = process.env.LEOGRAM_STORAGE_ACCESS_KEY_ID;
	const secret = process.env.LEOGRAM_STORAGE_SECRET_ACCESS_KEY;
	if (given && secret) {
		console.log('  ✔ Signing with the key in LEOGRAM_STORAGE_ACCESS_KEY_ID');
		return { key_id: given, secret, token: '', fresh: false };
	}

	const ours = listOf(await neon('GET', `${branch}/credentials`), 'credentials').find(
		(credential) => credential.name === CREDENTIAL
	);
	if (ours && stored?.key_id === ours.token_id) {
		console.log(`  ✔ Signing with ${CREDENTIAL}, as before`);
		return { key_id: stored.key_id, secret: stored.secret, token: ours.token_id, fresh: false };
	}
	if (ours) return renew(branch, ours.token_id);

	const made = await neon('POST', `${branch}/credentials`, {
		name: CREDENTIAL,
		scopes: ['storage:read', 'storage:write'],
		principal_type: 'user'
	});
	console.log(`  ✔ Made the credential ${CREDENTIAL}`);
	return keyOf(made);
}

/**
 * Sets the CORS rules, which is also how the key is tried: a refusal means a key that does not
 * work. One just made can take a moment to reach the bucket, and is given it; one the database
 * kept is given a new secret.
 */
async function setCors(branch, where, key) {
	for (let attempt = 1; ; attempt++) {
		const bucket = { ...where, key_id: key.key_id, secret: key.secret };
		try {
			await putCors(bucket);
			return bucket;
		} catch (error) {
			const refused = error instanceof S3Error && error.status === 403;
			if (refused && key.fresh && attempt <= 5) {
				await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
			} else if (refused && key.token && !key.fresh) {
				key = await renew(branch, key.token);
			} else {
				throw error;
			}
		}
	}
}

/** The tables that say where each file is: a file none of their rows names is left over. */
const KEYS = ['leogram_media', 'leogram_avatars'];

/**
 * Deletes the files nothing points to any more: no row of `KEYS`, in `public` or in any preview's
 * schema. They are what a browser was to delete and never got to — it was closed, or lost its
 * connection —, and what a dropped preview uploaded. A file is uploaded after its row is written,
 * so only files older than an hour before the rows were read are looked at: a younger one may be
 * on its way.
 */
async function sweep(sql, bucket) {
	const before = Date.now() - HOUR;
	const [{ query }] = await sql`
		select string_agg(format('select key from %I.%I', n.nspname, c.relname), ' union all ') as query
		from pg_class c join pg_namespace n on n.oid = c.relnamespace
		where c.relname in ${sql(KEYS)} and c.relkind = 'r'
	`;
	if (!query) return 0;
	const kept = new Set((await sql.unsafe(query)).map((row) => row.key));

	const files = (await listObjects(bucket)).filter((file) => OURS.test(file.key));
	const left = files.filter((file) => !kept.has(file.key) && file.written.getTime() < before);

	// Most of the published files at once is not what a few leftovers look like: more likely the
	// rows are somewhere this does not know about. Better to keep them and say so.
	const published = files.filter((file) => file.key.startsWith('public/')).length;
	const leaving = left.filter((file) => file.key.startsWith('public/')).length;
	if (leaving > 20 && leaving > published / 2) {
		throw new Error(
			`${leaving} of the ${published} published files look left over, which is too many to be: ` +
				`none was deleted. If the rows that name them moved, teach KEYS in db/storage.mjs.`
		);
	}

	for (const file of left) await deleteObject(bucket, file.key);
	return left.length;
}

/**
 * Does what a browser does, with addresses the database signs: asks the bucket whether a page may
 * upload (CORS), uploads a small file of the type and size it was signed for, reads it back, and
 * deletes it. Gives back what failed, or '' when it all went through.
 */
async function tryOut(sql) {
	const key = `public/try-${randomUUID()}.txt`;
	const body = `Leo OS, ${new Date().toISOString()}`;
	const size = Buffer.byteLength(body);
	const [signed] = await sql`
		select leogram_private.sign('PUT', ${key}, 300, now(), 'text/plain', ${size}) as put,
			leogram_private.sign('GET', ${key}, 300) as get,
			leogram_private.sign('DELETE', ${key}, 300) as delete
	`;

	const answer = async (what, request) => {
		try {
			return await request();
		} catch (error) {
			throw new Error(`${what}: ${error.message}`);
		}
	};
	const preflight = await answer('CORS', () =>
		fetch(signed.put, {
			method: 'OPTIONS',
			headers: {
				origin: 'https://leo-os.example',
				'access-control-request-method': 'PUT',
				'access-control-request-headers': 'content-type'
			}
		})
	);
	if (!preflight.headers.get('access-control-allow-origin')) {
		return `a page may not upload: CORS got ${preflight.status}, with no Access-Control-Allow-Origin`;
	}

	const put = await answer('upload', () =>
		fetch(signed.put, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body })
	);
	if (!put.ok) return `the upload got ${put.status}: ${await put.text()}`;
	const get = await answer('read', () => fetch(signed.get));
	const read = await get.text();
	if (!get.ok || read !== body) return `reading it back got ${get.status}: ${read.slice(0, 300)}`;
	const remove = await answer('delete', () => fetch(signed.delete, { method: 'DELETE' }));
	if (!remove.ok) return `deleting it got ${remove.status}: ${await remove.text()}`;
	return '';
}

async function main(sql) {
	console.log(`\n▸ Leo Partī's bucket, ${BUCKET}\n`);

	const [{ ready }] = await sql`select to_regclass('leogram_private.bucket') is not null as ready`;
	if (!ready) {
		console.log("  ▸ The database has no leogram_private.bucket yet: Leo Partī's migrations come first.\n");
		return;
	}

	const branch = await branchPath();
	let storage;
	try {
		const answer = await neon('GET', `${branch}/storage`);
		storage = answer.storage ?? answer;
	} catch (error) {
		if (error.status !== 404) throw error;
		throw new Error(`Object Storage is not available on the branch. ${error.message}`);
	}
	const endpoint = /^https?:\/\//.test(storage.s3_endpoint)
		? storage.s3_endpoint
		: `https://${storage.s3_endpoint}`;
	const where = { endpoint, region: storage.region, name: BUCKET };

	const buckets = listOf(await neon('GET', `${branch}/buckets`), 'buckets');
	const found = buckets.find((bucket) => bucket.name === BUCKET);
	if (!found) {
		await neon('POST', `${branch}/buckets`, { name: BUCKET, access_level: 'private' });
		console.log(`  ✔ Made the bucket, private, at ${endpoint}`);
	} else if (found.access_level && found.access_level !== 'private') {
		console.log(`  ▸ The bucket is ${found.access_level}: whoever knows a file's key reads it unsigned`);
	} else {
		console.log(`  ✔ The bucket is there, at ${endpoint}`);
	}

	const bucket = await sql.begin(async (tx) => {
		// Deploys run side by side. One at a time here, or two could each give the credential a new
		// secret, and the database end up keeping the one that was replaced.
		await tx`select pg_advisory_xact_lock(hashtext('leo-os leogram bucket'))`;
		const [stored] = await tx`select endpoint, region, name, key_id, secret from leogram_private.bucket`;

		const bucket = await setCors(branch, where, await pickKey(branch, stored));
		console.log('  ✔ CORS rules set: a page may read, upload and delete at an address the database signed');

		if (!stored || Object.entries(bucket).some(([name, value]) => stored[name] !== value)) {
			await tx`
				insert into leogram_private.bucket ${tx(bucket)}
				on conflict (single) do update set
					endpoint = excluded.endpoint, region = excluded.region, name = excluded.name,
					key_id = excluded.key_id, secret = excluded.secret, updated_at = now()
			`;
			console.log('  ✔ The database signs for it from now on');
		}
		return bucket;
	});

	const swept = await sweep(sql, bucket);
	console.log(swept ? `  ✔ Deleted ${swept} file(s) nothing pointed to any more` : '  ✔ No file left behind');

	const failed = await tryOut(sql);
	if (failed) throw new Error(`An address the database signed does not work: ${failed}`);
	console.log('  ✔ Tried as a browser would: the addresses the database signs upload, read and delete\n');
}

// Quiet: nothing here raises a notice worth reading.
const sql = postgres(process.env.DATABASE_URL, { onnotice: () => {} });

try {
	await main(sql);
} catch (error) {
	console.error(`\n✖ ${error.message}\n`);
	console.error('  Every deploy tries again; until one gets through, Leo Partī signs with the key it had.\n');
	process.exitCode = 1;
} finally {
	await sql.end();
}
