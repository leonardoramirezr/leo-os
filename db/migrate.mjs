// Applies every migration the database has not seen yet, and says which ones those were. Then it
// has the Data API read the tables again.
//
// `deploy.yml` runs this on the default branch, before building the site. It is `drizzle-kit
// migrate` underneath; the wrapper is here to turn a missing DATABASE_URL into a plain message
// instead of a stack trace, because a checkout without one is a normal thing to have.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { missingForNeon, refreshDataApi } from './neon.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));

// The same .env at the root the apps read for their VITE_NEON_* URLs. Vite loads it on its own;
// this is plain Node, so it has to be asked. In GitHub Actions there is no file and the secret is
// already in the environment.
try {
	process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
	// No .env: whatever the environment already carries is what there is.
}

if (!process.env.DATABASE_URL) {
	console.log('\n▸ No DATABASE_URL: nothing was applied.\n');
	console.log('  It is the connection string of the Neon project, from the console. In GitHub');
	console.log('  Actions it comes from the DATABASE_URL secret; locally it goes in .env.\n');
	process.exit(0);
}

const pending = readdirSync(new URL('migrations', import.meta.url))
	.filter((name) => name.endsWith('.sql'))
	.sort();
console.log(`\n▸ ${pending.length} migration(s) on disk; applying whatever is not in the database\n`);

// The roles the policies name belong to Neon and are created when the Data API is turned on, so
// that has to happen before the first migration. Its absence is what this error is about.
const { status } = spawnSync('pnpm', ['exec', 'drizzle-kit', 'migrate'], {
	cwd: here,
	stdio: 'inherit',
	env: process.env
});

if (status !== 0) {
	console.error('\n✖ The migration did not go through.');
	console.error('  If it says the role "authenticated" does not exist, turn the Data API on in');
	console.error('  the Neon console first: those roles are its, not ours.\n');
	process.exit(1);
}

console.log('\n✔ The database is up to date\n');

// The Data API answers from what it last read of the tables, and only reads them again when told or
// once its cache runs out: until then the site would find the new columns missing. It is told on
// every run, not just one that applied something, so that a run after one that could not tell it
// puts that right.
const missing = missingForNeon();
if (missing.length > 0) {
	console.log(`▸ Without ${missing.join(', ')}, the Data API sees the change once its cache runs out.\n`);
	process.exit(0);
}

try {
	await refreshDataApi();
} catch (error) {
	console.error(`✖ The Data API could not be told to read the tables again: ${error.message}`);
	console.error('  The migrations are applied. Run this again, or refresh the Data API from the Neon');
	console.error('  console: until then it answers with the columns it had.\n');
	process.exit(1);
}

console.log('✔ The Data API has read the tables again\n');
