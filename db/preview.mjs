// Gives a preview a database of its own, so that trying a branch never touches the published data.
//
//   node preview.mjs create <preview>   Brings the preview's schema up to date, making it if need be
//   node preview.mjs drop <preview>     Drops it, once its branch is gone
//
// <preview> is the preview's folder name, from scripts/preview-slug.sh, and the schema is named
// after it: `claude-wizardly-euler` gets `preview_claude_wizardly_euler`. `deploy.yml` runs `create`
// on every push of a branch, before building the preview; `preview-cleanup.yml` runs `drop`.
//
// A push that finds no schema — the branch's first, or the next one after a run that never got to
// commit, or after the schema was dropped — makes it a copy of `public`: its tables with their rows,
// sequences, enums, policies and grants. From then on it is kept, rows and all, and each push only
// applies the migrations it has not seen yet: the branch's own, and whatever the branch brings over
// from main. Which ones it has seen is its own migrations log, next to `public`'s in the `drizzle`
// schema. The Data API is told to serve the schema next to `public`; the preview is built to ask for
// it by name (VITE_NEON_DATA_API_SCHEMA), and the published site asks for none and keeps getting
// `public`.
//
// Each push is one transaction: a migration that fails leaves the schema as the push before left
// it. `public` is only ever read.

import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';
import { dataApiPath, missingForNeon, neon } from './neon.mjs';

// The same .env at the root that migrate.mjs reads. In GitHub Actions there is no file, and the
// values come from the repository's secrets and variables.
try {
	process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
	// No .env: whatever the environment already carries is what there is.
}

const [action, preview = ''] = process.argv.slice(2);

if (!['create', 'drop'].includes(action) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(preview)) {
	console.error('Usage: node preview.mjs create|drop <preview>, the name scripts/preview-slug.sh gives');
	process.exit(2);
}

// Every preview's schema, and nothing else, is named like this: it is what `drop` checks before
// dropping anything, and how the Data API's list tells previews apart. 63 bytes is as long as a
// Postgres name gets; anything longer would be cut short behind our back.
const schema = `preview_${preview.replaceAll('-', '_')}`.slice(0, 63).replace(/_+$/, '');
const isPreview = (name) => /^preview_[a-z0-9_]+$/.test(name);

const ident = (name) => `"${name.replaceAll('"', '""')}"`;

/** The migrations the preview's schema has, one row each, like `drizzle.__drizzle_migrations`. */
const LOG = `drizzle.${ident(schema)}`;

const databaseUrl = process.env.DATABASE_URL;
const missing = [...(databaseUrl ? [] : ['DATABASE_URL']), ...missingForNeon()];

/**
 * Tells the workflow which schema the build asks for (empty for the published one), and the
 * sentence about the preview's data that its summary and its pull request comment carry.
 */
function output(values) {
	if (!process.env.GITHUB_OUTPUT) return;
	const lines = Object.entries(values).map(([name, value]) => `${name}=${value}\n`);
	appendFileSync(process.env.GITHUB_OUTPUT, lines.join(''));
}

/** What a statement is made of, as far as `redirect` cares. */
const TOKEN = [
	/--[^\n]*/, // a comment to the end of the line
	/\/\*[\s\S]*?\*\//, // a comment between /* and */
	/[eE]'(?:[^'\\]|\\[\s\S]|'')*'/, // a string with backslash escapes
	/'(?:[^']|'')*'/, // a string
	/(\$\w*\$)([\s\S]*?)\1/, // a $$ block: its tag, then its body
	/"(?:[^"]|"")*"/, // a quoted name
	/[a-zA-Z_][\w$]*/, // a word
	/\S/ // anything else, one character at a time
]
	.map((part) => part.source)
	.join('|');

/**
 * Points a migration at the preview's schema: wherever it names `public` as a schema — `public.x`,
 * `"public"."x"`, `SCHEMA public` — it names the preview's instead, and anything unqualified lands
 * there through the search path. `TO public` is the PUBLIC role and stays; so does anything inside
 * comments and quotes, except the body of a `$$` block, which is SQL too.
 *
 * Changing the search path is refused: with it, a migration could send itself back to `public`.
 */
function redirect(statement) {
	// 'name' right after SCHEMA, or after a comma in its list; 'comma' after a name in that list.
	let expect = '';

	return statement.replace(new RegExp(TOKEN, 'g'), (match, tag, body, offset) => {
		if (match.startsWith('--') || match.startsWith('/*')) return match;
		if (tag !== undefined) return tag + redirect(body) + tag;

		const quoted = match.startsWith('"');
		const literal = /^[eE]?'/.test(match);
		const word = quoted
			? match.slice(1, -1).replaceAll('""', '"')
			: /^[a-z_]/i.test(match) && !literal
				? match.toLowerCase()
				: '';

		if ((word || match).toLowerCase().includes('search_path')) {
			throw new Error('it changes the search_path, which the preview cannot point at its schema');
		}
		if (!word) {
			expect = match === ',' && expect === 'comma' ? 'name' : '';
			return match;
		}

		const listed = expect === 'name';
		expect = listed ? 'comma' : !quoted && word === 'schema' ? 'name' : '';
		const qualifies = /^\s*\./.test(statement.slice(offset + match.length));
		return word === 'public' && (qualifies || listed) ? ident(schema) : match;
	});
}

// Whether an extension owns an object. What an extension installs in `public` stays its own: it is
// used from there, not copied.
const theirs = (classid, objid) =>
	`exists (select from pg_depend x where x.classid = ${classid} and x.objid = ${objid} and x.deptype = 'e')`;

const TABLES = `c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
	and not ${theirs("'pg_class'::regclass", 'c.oid')}`;

// A sequence's options, from `pg_sequence s`: the same for one of its own and an identity column's.
const OPTIONS = `format('increment by %s minvalue %s maxvalue %s start with %s cache %s %s', s.seqincrement,
	s.seqmin, s.seqmax, s.seqstart, s.seqcache, case when s.seqcycle then 'cycle' else 'no cycle' end)`;

const GRANTEE = `case a.grantee when 0 then 'public' else quote_ident(pg_get_userbyid(a.grantee)) end
	|| case when a.is_grantable then ' with grant option' else '' end`;

/**
 * Each query writes the statements of one step of the copy, in the order they must run. The
 * definitions are printed the way `public` sees itself — its own tables, types and sequences
 * unqualified — and replayed with the preview's schema first on the search path, so what named
 * something of `public` names the preview's copy of it. What lives elsewhere (`auth.user_id()`)
 * comes out qualified, and still points where it did. $1 is the preview's schema.
 */
const COPY = {
	enums: `
		select format('create type %I.%I as enum (%s)', $1::text, t.typname,
			string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder))
		from pg_type t join pg_enum e on e.enumtypid = t.oid
		where t.typnamespace = 'public'::regnamespace and not ${theirs("'pg_type'::regclass", 't.oid')}
		group by t.typname`,

	// Identity sequences are left out: each comes back with its column, under the same name.
	sequences: `
		select format('create sequence %I.%I as %s %s',
			$1::text, c.relname, format_type(s.seqtypid, null), ${OPTIONS})
		from pg_class c join pg_sequence s on s.seqrelid = c.oid
		where c.relnamespace = 'public'::regnamespace and c.relkind = 'S' and not exists (
			select from pg_depend x
			where x.classid = 'pg_class'::regclass and x.objid = c.oid and x.deptype in ('e', 'i')
		)`,

	tables: `
		select format('create table %I.%I (%s)', $1::text, c.relname, string_agg(concat_ws(' ',
			quote_ident(a.attname),
			format_type(a.atttypid, a.atttypmod),
			case when a.attcollation <> t.typcollation then 'collate ' || a.attcollation::regcollation::text end,
			case when a.attidentity <> '' then format('generated %s as identity (sequence name %I %s)',
				case a.attidentity when 'a' then 'always' else 'by default' end, q.relname, ${OPTIONS}) end,
			case a.attgenerated
				when 's' then format('generated always as (%s) stored', pg_get_expr(d.adbin, d.adrelid, true))
				when 'v' then format('generated always as (%s) virtual', pg_get_expr(d.adbin, d.adrelid, true))
				else 'default ' || pg_get_expr(d.adbin, d.adrelid, true) end,
			case when a.attnotnull then 'not null' end
		), ', ' order by a.attnum))
		from pg_class c
		join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
		join pg_type t on t.oid = a.atttypid
		left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
		left join pg_class q on a.attidentity <> ''
			and q.oid = pg_get_serial_sequence(format('public.%I', c.relname), a.attname)::regclass
		left join pg_sequence s on s.seqrelid = q.oid
		where ${TABLES}
		group by c.relname`,

	owned: `
		select format('alter sequence %I.%I owned by %I.%I.%I',
			$1::text, q.relname, $1::text, c.relname, a.attname)
		from pg_depend d
		join pg_class q on q.oid = d.objid
		join pg_class c on c.oid = d.refobjid
		join pg_attribute a on a.attrelid = c.oid and a.attnum = d.refobjsubid
		where d.classid = 'pg_class'::regclass and d.refclassid = 'pg_class'::regclass and d.deptype = 'a'
			and q.relkind = 'S' and q.relnamespace = 'public'::regnamespace and ${TABLES}`,

	// Generated columns are worked out again from the rest; identity columns keep their values. A
	// value of a type of `public` — an enum — goes through text into the preview's copy of the type.
	rows: `
		select format('insert into %I.%I (%s) overriding system value select %s from public.%I',
			$1::text, c.relname,
			string_agg(quote_ident(a.attname), ', ' order by a.attnum),
			string_agg(case when t.typnamespace = 'public'::regnamespace
				then format('%I::text::%s', a.attname, format_type(a.atttypid, a.atttypmod))
				else quote_ident(a.attname) end, ', ' order by a.attnum),
			c.relname)
		from pg_class c
		join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
		join pg_type t on t.oid = a.atttypid
		where ${TABLES}
		group by c.relname`,

	counters: `
		select format('select setval(%L, %s)', format('%I.%I', $1::text, s.sequencename), s.last_value)
		from pg_sequences s
		join pg_class c on c.relname = s.sequencename and c.relnamespace = 'public'::regnamespace
		where s.schemaname = 'public' and s.last_value is not null
			and not ${theirs("'pg_class'::regclass", 'c.oid')}`,

	// Once the rows are in; foreign keys last, when every table they point at is there.
	constraints: `
		select format('alter table %I.%I add constraint %I %s',
			$1::text, c.relname, k.conname, pg_get_constraintdef(k.oid, true))
		from pg_constraint k join pg_class c on c.oid = k.conrelid
		where ${TABLES} and k.contype in ('p', 'u', 'x', 'c', 'f')
		order by k.contype = 'f', c.relname, k.conname`,

	// Printed with its table unqualified, which is what puts it in the preview's schema; the second
	// column is there to make sure of it.
	indexes: `
		select pg_get_indexdef(i.indexrelid, 0, true), format(' ON %I USING ', c.relname)
		from pg_index i join pg_class c on c.oid = i.indrelid
		where ${TABLES} and not exists (
			select from pg_constraint k
			where k.conindid = i.indexrelid and k.conrelid = c.oid and k.contype in ('p', 'u', 'x')
		)`,

	security: `
		select format('alter table %I.%I enable row level security', $1::text, c.relname)
		from pg_class c where ${TABLES} and c.relrowsecurity
		union all
		select format('alter table %I.%I force row level security', $1::text, c.relname)
		from pg_class c where ${TABLES} and c.relforcerowsecurity
		union all
		select format('create policy %I on %I.%I as %s for %s to %s%s%s', p.polname, $1::text, c.relname,
			case when p.polpermissive then 'permissive' else 'restrictive' end,
			case p.polcmd
				when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all'
			end,
			(select string_agg(case r when 0 then 'public' else quote_ident(pg_get_userbyid(r)) end, ', ')
				from unnest(p.polroles) r),
			' using (' || pg_get_expr(p.polqual, p.polrelid, true) || ')',
			' with check (' || pg_get_expr(p.polwithcheck, p.polrelid, true) || ')')
		from pg_policy p join pg_class c on c.oid = p.polrelid
		where ${TABLES}`,

	// Who may reach what: the schema, its tables and sequences, and whatever a migration creates in
	// it later — which is how a table the branch adds is open to \`authenticated\` from the start.
	// Default privileges only count for the role that creates the objects, which in the preview's
	// schema is always this one.
	grants: `
		select format('grant %s on schema %I to %s', a.privilege_type, $1::text, ${GRANTEE})
		from pg_namespace n, aclexplode(n.nspacl) a
		where n.nspname = 'public' and a.grantee <> n.nspowner
		union all
		select format('grant %s on %s %I.%I to %s', a.privilege_type,
			case c.relkind when 'S' then 'sequence' else 'table' end, $1::text, c.relname, ${GRANTEE})
		from pg_class c, aclexplode(c.relacl) a
		where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'S') and a.grantee <> c.relowner
			and not ${theirs("'pg_class'::regclass", 'c.oid')}
		union all
		select format('alter default privileges in schema %I grant %s on %s to %s', $1::text, a.privilege_type,
			case d.defaclobjtype
				when 'r' then 'tables' when 'S' then 'sequences' when 'f' then 'functions' else 'types'
			end,
			${GRANTEE})
		from pg_default_acl d, aclexplode(d.defaclacl) a
		where d.defaclnamespace = 'public'::regnamespace and d.defaclrole = current_user::regrole`
};

/** What `public` may hold that the copy above does not know about: better to stop than to leave it out. */
const UNSUPPORTED = `
	select kind || ' ' || name as what from (
		select 'pg_class'::regclass as catalog, c.oid, c.relname::text as name,
			case c.relkind when 'v' then 'view' when 'm' then 'materialized view' when 'f' then 'foreign table'
				when 'p' then 'partitioned table' else 'type' end as kind
		from pg_class c
		where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm', 'f', 'p', 'c')
		union all
		select 'pg_class'::regclass, c.oid, c.relname, 'inherited table'
		from pg_inherits i join pg_class c on c.oid = i.inhrelid
		where c.relnamespace = 'public'::regnamespace
		union all
		select 'pg_proc'::regclass, p.oid, p.oid::regprocedure::text, 'function'
		from pg_proc p where p.pronamespace = 'public'::regnamespace
		union all
		select 'pg_trigger'::regclass, t.oid, t.tgname || ' on ' || c.relname, 'trigger'
		from pg_trigger t join pg_class c on c.oid = t.tgrelid
		where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
		union all
		select 'pg_rewrite'::regclass, r.oid, r.rulename || ' on ' || c.relname, 'rule'
		from pg_rewrite r join pg_class c on c.oid = r.ev_class
		where c.relnamespace = 'public'::regnamespace and r.rulename <> '_RETURN'
		union all
		-- Enums are copied, and array types come along with what they hold.
		select 'pg_type'::regclass, t.oid, t.typname, 'type'
		from pg_type t
		where t.typnamespace = 'public'::regnamespace and t.typtype not in ('c', 'e') and not exists (
			select from pg_depend x where x.classid = 'pg_type'::regclass and x.objid = t.oid and x.deptype = 'i'
		)
	) found
	where not ${theirs('found.catalog', 'found.oid')}
	order by what`;

/** Makes the preview's schema a copy of `public`. Gives back how many tables it copied. */
async function copyPublic(tx) {
	await tx`set local search_path = public`;

	const unsupported = await tx.unsafe(UNSUPPORTED);
	if (unsupported.length > 0) {
		const what = unsupported.map((row) => row.what).join(', ');
		throw new Error(`public holds what the copy does not know yet: ${what}. Teach COPY in db/preview.mjs.`);
	}

	// Every definition is printed now, while `public` is the search path; they run once it is not.
	const steps = {};
	for (const [step, query] of Object.entries(COPY)) {
		steps[step] = await tx.unsafe(query, query.includes('$1') ? [schema] : []).values();
	}

	for (const [ddl, target] of steps.indexes) {
		if (!ddl.includes(target)) throw new Error(`An index this script cannot place: ${ddl}`);
	}

	await tx.unsafe(`set local search_path = ${ident(schema)}, public`);
	await tx.unsafe(`drop schema if exists ${ident(schema)} cascade`);
	await tx.unsafe(`create schema ${ident(schema)}`);

	for (const [step, statements] of Object.entries(steps)) {
		// A policy that would hide rows from the copy is an error rather than a smaller copy.
		await tx.unsafe(`set local row_security = ${step === 'rows' ? 'off' : 'on'}`);
		for (const [ddl] of statements) {
			try {
				await tx.unsafe(ddl);
			} catch (error) {
				throw new Error(`Copying public (${step}): ${error.message}\n\n${ddl}\n`);
			}
		}
	}

	return steps.tables.length;
}

/**
 * The migrations of this checkout, in the journal's order. Each is known by `when`, the moment
 * drizzle-kit wrote it, which is also what a database's log keeps of it (as `created_at`); the hash
 * is of its SQL.
 */
function migrationsOnDisk() {
	const folder = fileURLToPath(new URL('migrations', import.meta.url));
	const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, 'utf8'));
	const names = new Map(journal.entries.map((entry) => [entry.when, entry.tag]));
	return readMigrationFiles({ migrationsFolder: folder }).map(({ sql, hash, folderMillis }) => ({
		sql,
		hash,
		when: folderMillis,
		name: names.get(folderMillis)
	}));
}

/** A migrations log, or `undefined` when there is none yet. Only a preview's keeps names. */
async function readLog(tx, table) {
	const [{ found }] = await tx`select to_regclass(${table}) is not null as found`;
	if (!found) return undefined;
	const rows = await tx.unsafe(`select * from ${table}`);
	return rows.map((row) => ({ when: Number(row.created_at), hash: row.hash, name: row.name }));
}

/** Starts the preview's log with what `public`'s says: the copy has all of that already. */
async function startLog(tx) {
	await tx.unsafe('create schema if not exists drizzle');
	await tx.unsafe(`drop table if exists ${LOG}`);
	await tx.unsafe(`create table ${LOG} (created_at bigint primary key, hash text not null, name text)`);
	const [{ found }] = await tx`select to_regclass('drizzle.__drizzle_migrations') is not null as found`;
	if (found) {
		await tx.unsafe(`insert into ${LOG} (created_at, hash)
			select created_at, hash from drizzle.__drizzle_migrations on conflict do nothing`);
	}
}

/** Applies these migrations inside the preview's schema, and writes each down in its log. */
async function applyMigrations(tx, migrations) {
	// The preview's schema alone: a name the migration leaves unqualified cannot fall through to
	// `public`.
	await tx.unsafe(`set local search_path = ${ident(schema)}`);

	for (const migration of migrations) {
		for (const statement of migration.sql) {
			if (!statement.trim()) continue;
			try {
				await tx.unsafe(redirect(statement));
			} catch (error) {
				throw new Error(`Migration ${migration.name}: ${error.message}\n\n${statement.trim()}\n`);
			}
		}
		await tx.unsafe(`insert into ${LOG} (created_at, hash, name) values ($1, $2, $3)`, [
			migration.when,
			migration.hash,
			migration.name
		]);
	}
}

/**
 * The last word before committing: nothing in the preview's schema leans on `public` — a foreign
 * key, a column's type, a sequence behind a default —, and nothing in `public` was written to.
 * Either would mean the preview and the published site share data after all.
 */
async function checkIsolation(tx) {
	const leaning = await tx`
		select distinct pg_describe_object(d.classid, d.objid, d.objsubid) || ' → ' ||
			pg_describe_object(d.refclassid, d.refobjid, d.refobjsubid) as what
		from pg_depend d
		-- A default, a policy, a view's query or a trigger says nothing of its schema: its table's is it.
		cross join lateral (select case d.classid
			when 'pg_attrdef'::regclass then (select adrelid from pg_attrdef where oid = d.objid)
			when 'pg_policy'::regclass then (select polrelid from pg_policy where oid = d.objid)
			when 'pg_rewrite'::regclass then (select ev_class from pg_rewrite where oid = d.objid)
			when 'pg_trigger'::regclass then (select tgrelid from pg_trigger where oid = d.objid)
		end as relid) owner
		cross join lateral pg_identify_object(
			case when owner.relid is null then d.classid else 'pg_class'::regclass end,
			coalesce(owner.relid, d.objid),
			0
		) o
		cross join lateral pg_identify_object(d.refclassid, d.refobjid, 0) r
		-- Up to Postgres 14 it also lists the pinned objects, under no class at all.
		where d.deptype <> 'p' and o.schema = ${schema} and r.schema = 'public' and not exists (
			select from pg_depend x where x.classid = d.refclassid and x.objid = d.refobjid and x.deptype = 'e'
		)
	`;
	if (leaning.length > 0) {
		const what = leaning.map((row) => row.what).join('; ');
		throw new Error(`The preview's schema still points at public: ${what}`);
	}

	const written = await tx`
		select relname from pg_stat_xact_user_tables
		where schemaname = 'public' and n_tup_ins + n_tup_upd + n_tup_del > 0
	`;
	if (written.length > 0) {
		throw new Error(`A migration wrote to public: ${written.map((row) => row.relname).join(', ')}`);
	}
}

/**
 * Tells the Data API which schemas to serve: every preview's that exists right now, after the ones
 * it already served that are not a preview's — `public` first among them, which keeps it the one a
 * request naming no schema gets. Doing so also refreshes what it knows of their tables.
 *
 * Previews publish side by side, and each rewrites the whole list: the lock makes them take turns,
 * and working the list out from the database makes the last one to write it right. The lock lasts
 * as long as the transaction, which a connection pooler keeps on one connection: one taken outside
 * of it could be let go of on another, and stay held for good.
 */
async function serve(sql) {
	const path = await dataApiPath();

	return sql.begin(async (tx) => {
		await tx`select pg_advisory_xact_lock(hashtext('leo-os previews'))`;

		const { settings } = await neon('GET', path);
		const previews = await tx`select nspname from pg_namespace order by nspname`;
		const schemas = [
			...(settings?.db_schemas ?? ['public']).filter((name) => !isPreview(name)),
			...previews.map((row) => row.nspname).filter(isPreview)
		];

		// Whatever is left out of `settings` goes back to its default, so everything else it had is
		// sent back as it was.
		const kept = Object.entries(settings ?? {}).filter(([, value]) => value !== null && value !== undefined);
		await neon('PATCH', path, { settings: { ...Object.fromEntries(kept), db_schemas: schemas } });
		return schemas;
	});
}

/**
 * Brings the preview's schema up to date: a copy of `public` when there is none yet, and from then
 * on only the migrations it has not seen. A migration is known by `when`, not by being newer than
 * the last one: after main is merged into the branch, main's migrations can be older than the
 * branch's own, and the preview still lacks them.
 */
async function create(sql) {
	console.log(`\n▸ ${schema}\n`);

	const done = await sql.begin('isolation level repeatable read', async (tx) => {
		const disk = migrationsOnDisk();
		const published = (await readLog(tx, 'drizzle.__drizzle_migrations')) ?? [];
		const publishedWhen = new Set(published.map((row) => row.when));
		const last = Math.max(0, ...publishedWhen);

		// drizzle only applies what is newer than the last migration a database has: one of the
		// branch's that is older would be skipped on main for good, and the preview would hide it.
		const late = disk.filter(
			(migration) => !publishedWhen.has(migration.when) && migration.when <= last
		);
		if (late.length > 0) {
			const names = late.map((migration) => migration.name).join(', ');
			throw new Error(
				`${names}: public already has a newer migration, so \`pnpm db:migrate\` would never ` +
					'apply this one on main. Generate it again with `pnpm db:generate`, after bringing ' +
					'main into the branch, so that it comes last.'
			);
		}

		const [{ exists }] = await tx`select to_regnamespace(${schema}) is not null as exists`;
		const log = exists ? await readLog(tx, LOG) : undefined;

		// A migration this schema applied that the branch has since changed or dropped: the schema
		// can no longer follow the branch, so it starts over. What `public` has too is not the
		// branch's to change.
		const onDisk = new Map(disk.map((migration) => [migration.when, migration]));
		const changed = (log ?? []).filter(
			(row) => !publishedWhen.has(row.when) && onDisk.get(row.when)?.hash !== row.hash
		);

		const fresh = !log || changed.length > 0;
		let tables = 0;
		if (fresh) {
			// One snapshot for the whole copy, so the rows of one table agree with those of the next.
			tables = await copyPublic(tx);
			await startLog(tx);
		}

		// A fresh copy has what `public` has; a schema kept from before, what its log says.
		const seen = new Set((fresh ? published : log).map((row) => row.when));
		const pending = disk.filter((migration) => !seen.has(migration.when));
		await applyMigrations(tx, pending);
		await checkIsolation(tx);

		return {
			copied: !log ? 'new' : fresh ? 'again' : '',
			tables,
			changed: changed.map((row) => row.name ?? new Date(row.when).toISOString()),
			applied: pending.map((migration) => migration.name)
		};
	});

	const list = (names) => names.map((name) => `\`${name}\``).join(', ');
	const onTop = done.applied.length > 0 ? `; applied on top: ${list(done.applied)}` : '';
	let data;
	if (done.copied === 'new') {
		console.log(`  ✔ No schema yet: ${done.tables} table(s) copied from public, rows included`);
		data = `a copy of the published data made at this push, as the preview had none yet${onTop}.`;
		data += ' Later pushes keep it, and only apply the migrations they bring.';
	} else if (done.copied === 'again') {
		console.log(`  ✔ Copied from public again: the branch changed ${done.changed.join(', ')}`);
		data = 'copied again from the published data at this push, since the branch changed migrations';
		data += ` the preview had already applied (${list(done.changed)})${onTop}.`;
	} else {
		console.log('  ✔ Kept from earlier pushes, rows included');
		data = 'kept from earlier pushes; ';
		data += done.applied.length > 0
			? `this one applied ${list(done.applied)}.`
			: 'this one brought no migrations.';
	}
	const applied = done.applied.join(', ');
	console.log(applied ? `  ✔ Applied ${applied}` : '  ✔ Nothing to apply');

	const served = await serve(sql);
	console.log(`  ✔ The Data API serves ${served.join(', ')}\n`);
	output({
		schema,
		data: `Its data: schema \`${schema}\`, ${data} Nothing done in the preview reaches the published site.`
	});
}

async function drop(sql) {
	console.log(`\n▸ Dropping ${schema}\n`);

	// Checked again right where it matters: only ever a preview's.
	if (!isPreview(schema)) throw new Error(`${schema} is not a preview's schema`);
	await sql.begin(async (tx) => {
		await tx.unsafe(`drop schema if exists ${ident(schema)} cascade`);
		await tx.unsafe(`drop table if exists ${LOG}`);
	});
	console.log('  ✔ Dropped, with its migrations log');

	if (missing.length > 0) {
		console.log(`  ▸ Without ${missing.join(', ')}, the Data API still lists it until the next preview.\n`);
		return;
	}
	const served = await serve(sql);
	console.log(`  ✔ The Data API serves ${served.join(', ')}\n`);
}

if (action === 'create' && missing.length > 0) {
	console.log(`\n▸ Without ${missing.join(', ')}, this preview uses the published data.\n`);
	console.log('  «Previews» in README.md says what each one is and where it goes.\n');
	output({
		schema: '',
		data: "Its data: the published site's own. The preview database is not set up (see «Previews»" +
			' in README.md).'
	});
	process.exit(0);
}

if (action === 'drop' && !databaseUrl) {
	console.log('\n▸ No DATABASE_URL: there is no schema to drop.\n');
	process.exit(0);
}

// Quiet: the notices are `drop schema … cascade` listing everything it took with it, which is the
// point of dropping it.
const sql = postgres(databaseUrl, { onnotice: () => {} });

try {
	await (action === 'create' ? create(sql) : drop(sql));
} catch (error) {
	console.error(`\n✖ ${error.message}\n`);
	process.exitCode = 1;
} finally {
	await sql.end();
}
