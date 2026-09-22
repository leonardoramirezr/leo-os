// Applies every migration the database has not seen yet, and says which ones those were.
//
// `deploy.yml` runs this on the default branch, before building the site. It is `drizzle-kit
// migrate` underneath; the wrapper is here to turn a missing DATABASE_URL into a plain message
// instead of a stack trace, because a checkout without one is a normal thing to have.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
