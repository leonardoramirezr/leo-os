-- Leo OS: the database the home screen and every app share.
--
-- Run it once against the Neon project, from the console's SQL Editor or with psql. It can be run
-- again: nothing here drops anything.
--
-- Every table is reached straight from the browser through the Data API, so row level security is
-- the whole of the protection: each row carries the account it belongs to and every policy checks
-- it against `auth.user_id()`, the `sub` of the Neon Auth session behind the request. Without a
-- session there is no token, without a token the Data API uses the `anonymous` role, and
-- `anonymous` is granted nothing at all.
--
-- Images never come here. The wallpaper and WillChat's conversation are far too large for rows
-- read on every open, and they stay in the browser's localStorage and IndexedDB.

-- The small preferences each app used to keep in localStorage, under the same prefixed keys:
-- `willchat:text-model`, `me-deben:my-bank`, and so on.
create table if not exists settings (
	user_id text not null default auth.user_id(),
	key text not null,
	value jsonb not null,
	primary key (user_id, key)
);

create table if not exists me_deben_people (
	id uuid primary key,
	user_id text not null default auth.user_id(),
	name text not null
);

create table if not exists me_deben_movements (
	id uuid primary key,
	user_id text not null default auth.user_id(),
	-- Deleting a person takes their whole history with them, which is what the app promises.
	person_id uuid not null references me_deben_people (id) on delete cascade,
	kind text not null check (kind in ('loan', 'payment')),
	-- Cents, always positive: `kind` is what gives it a sign.
	amount bigint not null check (amount > 0),
	date date not null,
	-- Null with no agreed return date, and with a payment agreement, which replaces it.
	due_date date,
	plan text not null default '' check (plan in ('', 'weekly', 'monthly')),
	plan_amount bigint not null default 0,
	plan_start date,
	from_bank text not null default '',
	to_bank text not null default '',
	note text not null default '',
	-- Epoch milliseconds. It only breaks the tie between movements sharing a date.
	created_at bigint not null default 0
);

-- Each account reads its own rows whole, every time an app opens.
create index if not exists me_deben_people_user on me_deben_people (user_id);
create index if not exists me_deben_movements_user on me_deben_movements (user_id);
create index if not exists me_deben_movements_person on me_deben_movements (person_id);

alter table settings enable row level security;
alter table me_deben_people enable row level security;
alter table me_deben_movements enable row level security;

-- `using` is what may be read, changed or deleted; `with check` what may be written. Both sides
-- are needed: without `with check` an account could file a row under someone else's name.
drop policy if exists settings_own on settings;
create policy settings_own on settings for all to authenticated
	using (user_id = auth.user_id())
	with check (user_id = auth.user_id());

drop policy if exists me_deben_people_own on me_deben_people;
create policy me_deben_people_own on me_deben_people for all to authenticated
	using (user_id = auth.user_id())
	with check (user_id = auth.user_id());

drop policy if exists me_deben_movements_own on me_deben_movements;
create policy me_deben_movements_own on me_deben_movements for all to authenticated
	using (user_id = auth.user_id())
	with check (user_id = auth.user_id());

grant usage on schema public to authenticated;
grant select, insert, update, delete on settings, me_deben_people, me_deben_movements
	to authenticated;

-- Signed out there is nothing to see. Said out loud so that granting it stays a deliberate act.
revoke all on settings, me_deben_people, me_deben_movements from anonymous;
