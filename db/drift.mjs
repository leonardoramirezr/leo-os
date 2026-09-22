// Catches the one mistake this setup makes easy: changing `schema.ts` and forgetting to run
// `pnpm db:generate`, which would deploy a site expecting columns the database was never told
// about.
//
// It asks drizzle-kit for the migration those changes need. Nothing written means the models and
// the migrations agree. A new file means they do not — and that file is the missing migration,
// which is what should have been committed.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const migrations = new URL('migrations', import.meta.url);

const sql = () => readdirSync(migrations).filter((name) => name.endsWith('.sql'));

const before = sql();

// No stdin: a change drizzle-kit cannot read on its own — renaming a column looks like dropping
// one and adding another — asks about it, and there is nobody here to answer.
const generated = spawnSync('pnpm', ['exec', 'drizzle-kit', 'generate', '--name=pending'], {
	cwd: here,
	encoding: 'utf8',
	stdio: ['ignore', 'pipe', 'pipe'],
	timeout: 120_000
});

const added = sql().filter((name) => !before.includes(name));

if (generated.status !== 0 && added.length === 0) {
	console.error(generated.stdout ?? '');
	console.error(generated.stderr ?? '');
	console.error('\n✖ drizzle-kit could not work out the migration on its own.');
	console.error('  Run `pnpm db:generate` and answer what it asks.\n');
	process.exit(1);
}

if (added.length > 0) {
	console.error('\n✖ The models changed and no migration says so.\n');
	console.error('  The missing migration has just been written for you:\n');
	for (const name of added) console.error(`    db/migrations/${name}`);
	console.error('\n  Read it, give it a name you like, and commit it with the models.\n');
	process.exit(1);
}

console.log('✔ The models and the migrations agree');
