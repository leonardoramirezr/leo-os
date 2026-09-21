// What the tables hold, as the Data API hands them over. It mirrors `db/schema.sql` by hand:
// nothing generates it, so a change there is a change here.
//
// Every row carries the account it belongs to. The client always sends it; the policies in the
// schema are what enforce it.

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** One row per account and key: the small preferences every app used to keep in localStorage. */
export interface SettingRow {
	user_id: string;
	key: string;
	value: Json;
}

export interface PersonRow {
	id: string;
	user_id: string;
	name: string;
}

export interface MovementRow {
	id: string;
	user_id: string;
	person_id: string;
	kind: 'loan' | 'payment';
	/** Cents, always positive. `kind` is what gives it a sign. */
	amount: number;
	/** "YYYY-MM-DD", which is how a Postgres `date` travels over the Data API. */
	date: string;
	/** Null where the app has '': no agreed date, or an agreement instead of one. */
	due_date: string | null;
	plan: '' | 'weekly' | 'monthly';
	plan_amount: number;
	plan_start: string | null;
	from_bank: string;
	to_bank: string;
	note: string;
	/** Epoch milliseconds. It only breaks the tie between movements sharing a date. */
	created_at: number;
}
