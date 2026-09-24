# Leo OS

A collection of static web apps published together on GitHub Pages. The home screen mimics an
phone home screen: every app is an icon.

- Home: https://leonardoramirezr.github.io/leo-os/
- WillChat: https://leonardoramirezr.github.io/leo-os/willchat/
- Me deben: https://leonardoramirezr.github.io/leo-os/me-deben/

## Layout

```
.
├── home/                    # Home screen (SvelteKit + Svelte 5)
├── apps/
│   └── willchat/            # One folder per app
│       ├── app.json         # Manifest: { "name": "WillChat" }
│       ├── icon.svg         # The app's icon
│       └── …
├── shared/                  # The account and the database, used by the home screen and every app
├── db/
│   ├── schema.ts            # The models: the tables and their row level security policies
│   └── migrations/          # Generated from the models; the deploy applies them
├── scripts/
│   ├── build.mjs            # Builds the home screen and every app into dist/
│   ├── icons.mjs            # Turns each icon.svg into the PNG iOS asks for
│   ├── preview.mjs          # Serves dist/ the way GitHub Pages does
│   ├── preview-slug.sh      # The folder a branch gets inside previews/
│   ├── previews-index.mjs   # Builds the list of published previews
│   └── publish-pages.sh     # Writes the site (or a preview) into gh-pages
└── .github/workflows/
    ├── deploy.yml           # Publishes on every push
    └── preview-cleanup.yml  # Drops the preview when the branch is deleted
```

## An app's contract

Every folder inside `apps/` is an app and is published at `<BASE_PATH>/<folder>/`. The home screen
discovers them at build time, so there is nowhere else to register them.

| File           | What it must hold                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `app.json`     | `{ "name": "Visible name" }`                                                                     |
| `icon.svg`     | A square, full-bleed icon with no rounded corners: the home screen and iOS apply the mask.       |
| `package.json` | A `build` script that writes `build/index.html` using the `BASE_PATH` environment variable as its base path. |

On top of that:

- The folder name is part of the URL: lowercase letters, digits and dashes only.
- The iPhone home screen icon comes from that same `icon.svg`: there is no second drawing to make.
- Everything renders on the client. There is no backend of ours: an app queries Neon directly, as
  described in [Account and data](#account-and-data).
- Every app shares the `leonardoramirezr.github.io` origin, and therefore the session, `localStorage`
  and IndexedDB too. Use a prefix of your own in the keys (e.g. `willchat:`).

For a new SvelteKit app, start from `pnpm dlx sv create apps/<folder> --template minimal --types ts --add sveltekit-adapter="adapter:static"`
and copy two details from `apps/willchat`: `paths.base` read from `BASE_PATH` in `vite.config.ts`,
and `ssr = false` + `prerender = true` in `src/routes/+layout.ts`.

## Development

Requires Node 24+ and pnpm.

```sh
pnpm install
cp .env.example .env           # where Neon is; without it every screen says there is no database
pnpm --filter willchat dev     # one app
pnpm --filter home dev         # the home screen
pnpm check                     # svelte-check across every project, and the models against the migrations
pnpm icons                     # regenerates the apple-touch-icon.png files after editing an icon.svg

pnpm db:generate               # writes the migration for what changed in db/schema.ts
pnpm db:migrate                # applies the pending migrations to DATABASE_URL
```

To try the whole site the way it is published:

```sh
BASE_PATH=/apps pnpm build
BASE_PATH=/apps pnpm preview   # http://localhost:4173/apps/
```

## Account and data

Everything an app records — who owes what, which models WillChat uses — lives in one Neon Postgres
database and is queried straight from the browser. There is still no backend of ours in between:
[Neon Auth](https://neon.com/docs/auth/overview) holds the session and the
[Neon Data API](https://neon.com/docs/data-api/overview) (PostgREST over HTTPS) serves the tables.

- **Signing in.** The home screen and every app open behind the same door. Neon Auth keeps the
  session in a cookie of its own domain, so signing in once covers the whole site. It is asked for
  with `rememberMe`, which makes the cookie outlive closing the tab; how long it may live is the
  session lifetime configured in the Neon console.
- **One account, one set of rows.** Every table carries the account a row belongs to, and the
  policies in `db/schema.ts` only ever let `auth.user_id()` — the account behind the request's
  token — see its own. Signed out there is no token, and the `anonymous` role is granted nothing.
- **Images stay on the device.** The wallpaper and WillChat's conversation are far too large for
  rows read on every open, so they stay in `localStorage` and IndexedDB. Their keys carry the
  account too: two people using the same phone do not see each other's, and signing out drops the
  lot.
- **Offline.** Each app keeps a copy of its rows on the device, so it opens with something on
  screen and still shows it with no connection. The database is what counts: the copy is replaced
  whole every time a query comes back. A change is applied on screen first and sent right after; if
  it is refused, the app reads the rows again and a banner says what happened.

`shared/` holds all of this — the two clients, the sign-in screen, the account panel — and is a
workspace package every project depends on.

### Models and migrations

`db/schema.ts` is the models: the one place a table is described. The row types the browser works
in come from it too, so a column is spelled once and the apps stop typechecking if it moves.

A change to it is a change in two steps:

```sh
# 1. Edit db/schema.ts, then write the SQL for what changed
pnpm db:generate

# 2. Read the migration it wrote, commit it next to the models
git add db/migrations
```

`pnpm check` fails if you skip the first step — and writes the missing migration while it is at it,
so the fix is to read what it left in `db/migrations/` and commit that.

Applying them is the deploy's job: `deploy.yml` runs `pnpm db:migrate` on the default branch,
before building. Each migration runs once, in order, and the database remembers which ones it has
seen. To apply them by hand, put the connection string in `DATABASE_URL` and run `pnpm db:migrate`.

Only the default branch migrates. The migrations are one line of history, and two branches applying
their own would tangle it, so **a preview runs against whatever schema `main` last left** — a branch
that needs a new column has to be merged before its preview works.

Two things drizzle-kit does not track, and `db/migrations/0001_grants.sql` does by hand: which
roles may reach a table at all, and that a table a later migration creates inherits the same. That
last part is what keeps a new model from needing anything added there.

### Setting it up

In the [Neon console](https://console.neon.tech), on the project this site uses:

1. **Auth.** Turn Neon Auth on and copy its URL (`…/auth`). Under its configuration, add
   `https://leonardoramirezr.github.io` as a trusted domain — previews live on the same origin, so
   one entry covers them all — and set the session lifetime to a year.
2. **Data API.** Turn it on and copy its URL (`…/rest/v1`). If it asks which origins may call it,
   that same one. Do this before the first migration: the `authenticated` and `anonymous` roles the
   policies name are its, and turning it on is what creates them.
3. **Tables.** They come from the migrations, which the deploy applies on its own. To do it by
   hand instead: `DATABASE_URL=… pnpm db:migrate`.

Then, in this repository under **Settings → Secrets and variables → Actions**:

| | Name | What |
| --- | --- | --- |
| **Variables** | `NEON_AUTH_URL` | The Auth URL from step 1 |
| **Variables** | `NEON_DATA_API_URL` | The Data API URL from step 2 |
| **Secrets** | `DATABASE_URL` | The project's connection string, for the migrations |

The two URLs are not secrets: they are the public addresses of services that decide for themselves
what the caller may see, and they end up in the published JavaScript either way. The connection
string is: it opens the whole database with none of the policies in the way, which is why only the
default branch's run is given it.

For `pnpm dev`, `pnpm build` and `pnpm db:migrate`, the same three values go in a `.env` at the
root — see `.env.example`.

A build with no Neon URLs still builds and runs, and every screen says there is no database.

> **Safari and the cookie.** The site is served from `github.io` and Neon Auth from its own domain,
> so its session cookie is a third-party one. Safari blocks those by default, which would leave the
> iPhone asking to sign in over and over. If that happens, the way out is a custom domain: point
> GitHub Pages at one you own and Neon Auth at a subdomain of it, and the cookie stops being
> third-party.

## Deploy

Everything is published to the `gh-pages` branch, which is the only thing GitHub Pages serves:

| What is pushed | Where it lands         | URL                                  |
| -------------- | ---------------------- | ------------------------------------ |
| `main`         | the root of `gh-pages` | `…github.io/leo-os/`                 |
| any other branch | `previews/<branch>/` | `…github.io/leo-os/previews/<branch>/` |

`deploy.yml` runs on every push: it passes `pnpm check`, brings the database up to date if this is
the default branch, builds with the base path it is due and `scripts/publish-pages.sh` writes the
result into `gh-pages`. Publishing the site does not wipe the
previews, and each branch only touches its own folder; if two publish at once, the script reads the
branch again and retries.

The very first time, and in this order: first a push to `main`, which is what writes the site to the
root of `gh-pages`; then, in the repository, **Settings → Pages → Build and deployment → Source:
Deploy from a branch**, choosing the `gh-pages` branch with the `/ (root)` folder. The other way
round, the site stays a 404 until the next push to `main`. As long as that setting is left alone,
Pages keeps serving the last deploy made with the previous option («GitHub Actions») and none of
this shows up published.

## Previews

Every branch other than `main` is published on its own, so a change can be opened and tried before
it is merged.

- The folder name comes from the branch name under the same rule as the apps —lowercase, digits and
  dashes—, so `claude/wizardly-euler` is served at `/leo-os/previews/claude-wizardly-euler/`.
- If the branch has an open PR, the workflow leaves a comment there with the link and keeps it
  updated. The link also shows up in each run's summary, even before there is a PR.
- `…/leo-os/previews/` lists the ones that exist, newest to oldest.
- When the branch is deleted, `preview-cleanup.yml` drops its folder. Once none are left,
  `previews/` disappears. GitHub runs that workflow from `main`, so the cleanup starts working once
  the file lands there.
- GitHub Pages takes about a minute to serve what was just published.

A preview lives on the same origin as the published site, so it shares the session, `localStorage`
and IndexedDB with it: it opens already signed in, and trying «Me deben» in a preview moves the
same data as the real app.

## Home screen icon

Safari will not take an SVG for the icon saved with «Add to Home Screen»: without a PNG, it saves a
screenshot of the page instead. That is why `scripts/icons.mjs` turns each `icon.svg` into a
180 × 180 `apple-touch-icon.png` inside the project's `static/`, and each `app.html` links it with
`<link rel="apple-touch-icon">`. The PNG is generated at build and install time; it is not
versioned, so the SVG stays the only source.

The icon has to be opaque and reach the edges: iOS applies its own rounded mask and paints anything
transparent black. Safari also caches the icon eagerly; if the old one keeps showing up while
testing, close the tab and open the page again.

## Home

Besides the published apps, the home screen carries two icons of its own:

- **Recargar**: reloads the site, handy when it runs full screen without browser controls.
- **Ajustes**: changes the wallpaper, and shows which account is signed in with the way out. The
  chosen photo is scaled down to 1600 px, re-encoded as JPEG and stored in the browser's
  `localStorage` under `home:wallpaper`, one per account. With no photo, the default gradient is
  used, which comes back on «Quitar».

## WillChat

A ChatGPT-style chat for creating and editing images with the OpenAI API and your own API key.

- The API key is stored in your account, where the policies let no one else read it, and is only
  ever sent to `api.openai.com`. Keeping it there is what saves entering it again on every device.
- The text and image models are chosen by tapping the title. The list comes from `/v1/models`, and
  any ID can also be typed in.
- Photos are scaled down to 2048 px and sent as `input_image`. Every turn sends the whole
  conversation, generated images included, so the model can keep editing them.
- Requests use `background: true` and are polled every 2 s. Generating an image can take more than a
  minute and Safari on iOS cuts off requests that go 60 s without a response; this way the answer is
  also recovered if you reload or switch apps.
- The current conversation is stored in IndexedDB, under a key that carries the account: it is full
  of images, which is why it does not go to the database.

## Me deben

A ledger of who owes you money: opening it shows how much you are owed in total, how much of that is
already overdue, the list of people who owe, and two buttons at the bottom.

- **+** («Presté») records a new loan. First comes who: the people already recorded show up, and
  typing a name that is not there offers to add it. Then the amount, when it was lent, when it is
  due back, which bank the money left from and which bank it landed in. The due date is optional:
  without it the loan is never marked overdue.
- A loan may carry a **payment agreement**, also optional and with only two shapes: weekly or
  monthly. You enter how much is collected each week (or each month) and the first charge date; from
  there on the charges fall on the same day of the week, or the same day of the month clamped to the
  last one if that month is shorter. The last charge is whatever is left of the loan, so it can be
  smaller. With an agreement no due date is asked for: the schedule of charges replaces it.
- **−** («Me pagaron») records a payment. It only lists whoever owes something and proposes the
  whole debt as the amount, which can be edited down for a partial payment.
- Overdue means past its due date and still unpaid; with a payment agreement, whatever the charges
  already behind us add up to and are still uncovered. The charge of the day does not count as
  overdue until the next day. Each row in the list shows how much that person owes overdue, or **Al
  corriente** when nothing of theirs is overdue; whoever is overdue comes first.
- Payments are not recorded against a particular loan, so they are spread over the loans that come
  due first: paying settles the most overdue debt first.
- Tapping a person shows how much they owe in total and how much is already overdue, their history
  of loans and payments —each loan with its due date, or **Sin fecha de devolución** when none was
  agreed, or with its agreement and next charge, and what is left to cover—, and from there you can
  lend to them again, record a payment, change their name or delete them.
- Tapping a movement opens it for correcting: amount, dates, payment agreement, accounts and note.
  Whose it is and whether it was a loan or a payment do not change; that is what «Editar» is for,
  which brings out the red button on each row to delete what was recorded by mistake.
- Only a person who no longer owes anything can be deleted, and their name has to be typed first to
  confirm: they go with their whole history and it cannot be undone.
- The bank list («Cuentas») carries the Mexican institutions grouped: banks, fintech and
  non-banking, development banking, corporate and foreign, and cash. The bank's name is stored,
  never an account number. Your own bank is remembered so it need not be picked every time.
- Everything lives in your account, in the `me_deben_people` and `me_deben_movements` tables, with
  a copy on the device so the app opens without waiting. Amounts are stored as whole cents so
  balances do not accumulate rounding errors. What an earlier version left under the `me-deben:*`
  keys of this browser is brought over the first time you sign in, and only into an empty ledger.
