// The models: what the database holds, and the only place it is described. `pnpm db:generate`
// reads this file, compares it with the last migration, and writes the SQL for the difference into
// `migrations/`; `pnpm db:migrate` applies what is pending. Nothing is ever edited straight into
// the database — a change starts here.
//
// Every table is reached straight from the browser through the Data API, so row level security is
// the whole of the protection: each row carries the account it belongs to and every policy checks
// it against `auth.user_id()`, the `sub` of the Neon Auth session behind the request. Without a
// session there is no token, without a token the Data API uses the `anonymous` role, and
// `anonymous` is granted nothing at all.
//
// Images never come here. The wallpaper and WillChat's conversation are far too large for rows
// read on every open, and they stay in the browser's localStorage and IndexedDB.
//
// Fields are named after their columns, not in camelCase: the Data API hands rows over as the
// columns are spelled, and `shared/` re-exports `$inferSelect` as the shape the browser works in.
import { sql } from 'drizzle-orm';
import { authenticatedRole } from 'drizzle-orm/neon';
import {
	bigint,
	check,
	date,
	index,
	jsonb,
	pgPolicy,
	pgTable,
	primaryKey,
	text,
	uuid
} from 'drizzle-orm/pg-core';

/** Anything that survives `JSON.stringify`, which is all a `jsonb` column ever holds here. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** The account a row belongs to, filled in by Postgres from the token behind the request. */
const account = () =>
	text()
		.notNull()
		.default(sql`auth.user_id()`);

/**
 * Lets an account at its own rows and at nothing else. `using` is what may be read, changed or
 * deleted; `withCheck` what may be written. Both sides are needed: without `withCheck` an account
 * could file a row under someone else's name.
 */
const ownRows = (name: string) =>
	pgPolicy(name, {
		for: 'all',
		to: authenticatedRole,
		using: sql`user_id = auth.user_id()`,
		withCheck: sql`user_id = auth.user_id()`
	});

/**
 * The small preferences each app used to keep in localStorage, under the same prefixed keys:
 * `willchat:text-model`, `me-deben:my-bank`, and so on.
 */
export const settings = pgTable(
	'settings',
	{
		user_id: account(),
		key: text().notNull(),
		value: jsonb().$type<Json>().notNull()
	},
	(table) => [primaryKey({ columns: [table.user_id, table.key] }), ownRows('settings_own')]
).enableRLS();

export const people = pgTable(
	'me_deben_people',
	{
		id: uuid().primaryKey(),
		user_id: account(),
		name: text().notNull()
	},
	(table) => [index('me_deben_people_user').on(table.user_id), ownRows('me_deben_people_own')]
).enableRLS();

export const movements = pgTable(
	'me_deben_movements',
	{
		id: uuid().primaryKey(),
		user_id: account(),
		// Deleting a person takes their whole history with them, which is what the app promises.
		person_id: uuid()
			.notNull()
			.references(() => people.id, { onDelete: 'cascade' }),
		kind: text().$type<'loan' | 'payment'>().notNull(),
		/** Cents, always positive: `kind` is what gives it a sign. */
		amount: bigint({ mode: 'number' }).notNull(),
		date: date().notNull(),
		/** Null with no agreed return date, and with a payment agreement, which replaces it. */
		due_date: date(),
		plan: text().$type<'' | 'weekly' | 'monthly'>().notNull().default(''),
		plan_amount: bigint({ mode: 'number' }).notNull().default(0),
		plan_start: date(),
		from_bank: text().notNull().default(''),
		to_bank: text().notNull().default(''),
		note: text().notNull().default(''),
		/** Epoch milliseconds. It only breaks the tie between movements sharing a date. */
		created_at: bigint({ mode: 'number' }).notNull().default(0)
	},
	(table) => [
		check('me_deben_movements_kind', sql`${table.kind} in ('loan', 'payment')`),
		check('me_deben_movements_amount', sql`${table.amount} > 0`),
		check('me_deben_movements_plan', sql`${table.plan} in ('', 'weekly', 'monthly')`),
		index('me_deben_movements_user').on(table.user_id),
		index('me_deben_movements_person').on(table.person_id),
		ownRows('me_deben_movements_own')
	]
).enableRLS();

// What the browser reads and writes. `shared/` re-exports these, so a column is described once:
// rename one here and the apps stop typechecking until they follow.
export type SettingRow = typeof settings.$inferSelect;
export type PersonRow = typeof people.$inferSelect;
export type MovementRow = typeof movements.$inferSelect;
