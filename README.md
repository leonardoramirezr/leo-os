# Leo OS

A collection of static web apps published together on GitHub Pages. The home screen mimics an
phone home screen: every app is an icon.

- Home: https://leonardoramirezr.github.io/leo-os/
- WillChat: https://leonardoramirezr.github.io/leo-os/willchat/
- Me deben: https://leonardoramirezr.github.io/leo-os/me-deben/
- Lista: https://leonardoramirezr.github.io/leo-os/lista/
- Repaso: https://leonardoramirezr.github.io/leo-os/repaso/
- Dictado: https://leonardoramirezr.github.io/leo-os/dictado/
- Leogram: https://leonardoramirezr.github.io/leo-os/leogram/

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
│   ├── migrations/          # Generated from the models; the deploy applies them
│   └── preview.mjs          # Gives each preview a copy of the database of its own
├── neon/
│   └── auth-proxy.ts        # Stands Neon Auth on an own domain (see «Own domain»)
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
- Every app shares the site's origin, and therefore the session, `localStorage` and IndexedDB too. Use a prefix of your own in the keys (e.g. `willchat:`).
- Colours that change between light and dark are written as `light-dark(light, dark)` under
  `color-scheme: light dark`, not in an `@media (prefers-color-scheme)` block: that is how the theme
  picked in the home screen's Ajustes reaches the app.

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
pnpm db:migrate                # applies the pending migrations to DATABASE_URL, and tells the Data API
pnpm db:preview create <name>  # a preview's own schema: public copied once, then this branch's migrations
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
The one exception is on an [own domain](#own-domain), where a function that only forwards stands
Neon Auth on that domain.

- **Signing in.** The home screen and every app open behind the same door. Neon Auth keeps the
  session in a cookie of its own domain, so signing in once covers the whole site. It is asked for
  with `rememberMe`, which makes the cookie outlive closing the tab; how long it may live is the
  session lifetime configured in the Neon console.
- **Confirming the email.** An account gets no session until its email is confirmed. Right after
  signing up, the door asks for the code Neon Auth emailed; left for later, signing in with that
  email asks for it again. «Enviar otro código» emails a new one, and the one before stops working.
- **One account, one set of rows.** Every table carries the account a row belongs to, and the
  policies in `db/schema.ts` only ever let `auth.user_id()` — the account behind the request's
  token — see its own. Signed out, the Data API sees the anonymous token Neon Auth hands anybody
  and runs it as the `anonymous` role, which reaches no table: all it may do is open a Leogram post
  whose link it has ([Leogram](#leogram)).
- **Images stay on the device.** The wallpaper and WillChat's conversation are far too large for
  rows read on every open, so they stay in `localStorage` and IndexedDB. Their keys carry the
  account too: two people using the same phone do not see each other's, and signing out drops the
  lot. A Leogram post's photos are the exception: they are meant to be seen on other devices, so
  they go to the database, in rows of their own that are only read when the post is opened.
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

Then it tells the Data API to read the tables again. The Data API answers from what it last read of
them, and only reads them again when told or once its cache runs out: until then, the site would
find the new columns missing. Telling it takes `NEON_API_KEY` and `NEON_PROJECT_ID` ([Setting it
up](#setting-it-up)); without them `pnpm db:migrate` says so, and leaves it to the cache. With them,
a run that cannot tell it fails before the site is published, and the next one tells it again.

Only the default branch migrates `public`. The migrations are one line of history, and two branches
applying their own would tangle it. A branch's migrations are tried in its preview instead, on a copy
of the database of its own ([Previews](#previews)), so a new column works in the preview before the
branch is merged.

Two things drizzle-kit does not track, and `db/migrations/0001_grants.sql` does by hand: which
roles may reach a table at all, and that a table a later migration creates inherits the same. That
last part is what keeps a new model from needing anything added there.

### Setting it up

In the [Neon console](https://console.neon.tech), on the project this site uses:

1. **Auth.** Turn Neon Auth on and copy its URL (`…/auth`). Under its configuration, add
   `https://leonardoramirezr.github.io` as a trusted domain — previews live on the same origin, so
   one entry covers them all — and set the session lifetime to a year. Under **Sign-up with
   Email**, turn on **Verify at Sign-up** with **Verification code**: the sign-in screen asks for a
   code, not a link. Signing in with an email still unconfirmed only emails a fresh code if sending
   on sign-in is on as well, which the Neon CLI does with
   `neon neon-auth config email-password update --send-verification-email-on-sign-in`; without it
   the screen still asks, and «Enviar otro código» is what sends one.
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
| **Variables** | `NEON_PROJECT_ID` | The project's ID, from its settings in the console |
| **Secrets** | `DATABASE_URL` | The project's connection string, for the migrations and the previews |
| **Secrets** | `NEON_API_KEY` | A Neon API key, to tell the Data API what to serve and when to look again |

The two URLs are not secrets: they are the public addresses of services that decide for themselves
what the caller may see, and they end up in the published JavaScript either way. The connection
string and the API key are: the first opens the whole database with none of the policies in the way,
the second whatever the key reaches — a project-scoped key (organization **Settings → API keys**)
keeps that to this project. The default branch's run uses both to migrate `public` and have the Data
API read it again; a preview's, to make its own schema, and all it does with `public` is read it.

For `pnpm dev`, `pnpm build` and the `pnpm db:*` commands, the same values go in a `.env` at the
root — see `.env.example`.

A build with no Neon URLs still builds and runs, and every screen says there is no database.

### Own domain

Neon Auth lives at `*.neon.tech`, so to a site on `github.io` its session cookie is a third-party
one. Safari in a tab may let it through; a web app saved to the iPhone home screen never does, and
there signing in goes through and the very next call is told the session ran out. The way out is to
serve the site and Neon Auth from the same site: the site on a domain of its own, Neon Auth on a
subdomain of it. Neon Auth cannot be given a domain, so a [Neon Function](https://neon.com/docs/compute/functions/overview)
that only forwards to it, `neon/auth-proxy.ts`, takes that subdomain instead. The Data API stays as
it is: it is shown a token, not a cookie, and answers any origin.

With a free subdomain from [Open Domains](https://open-domains.com), say `leo-os.is-cool.dev` — pick
one of its domains on the [Public Suffix List](https://publicsuffix.org) (`is-cool.dev`,
`is-not-a.dev`, `localplayer.dev`, `is-local.org`, `is-a-fullstack.dev`), so that the subdomain is a
site of its own and not shared with everyone else's:

1. **The site.** At Open Domains, a `CNAME` from `leo-os.is-cool.dev` to `leonardoramirezr.github.io`,
   DNS only (not proxied). Then the repository variable `PAGES_DOMAIN` = `leo-os.is-cool.dev` and a
   run of `deploy.yml` on `main` (Actions → Deploy to GitHub Pages → Run workflow): the site is
   built for the domain's root and ships the `CNAME` file GitHub Pages reads its domain from — the
   variable, not the field in **Settings → Pages**, is what decides, since every publish replaces
   that file. Once the certificate is issued, tick **Enforce HTTPS** there. `github.io/leo-os/`
   redirects to the domain from then on; previews published before need a push to move with it.
2. **The function.** With the [Neon CLI](https://neon.com/docs/cli), linked to this project and
   its production branch:

   ```sh
   neon functions deploy authproxy --src neon/auth-proxy.ts \
     --env NEON_AUTH_ORIGIN=https://ep-xxx.neonauth.c-7.us-east-2.aws.neon.tech \
     --env SITE_ORIGIN=https://leo-os.is-cool.dev
   neon functions domains register auth.leo-os.is-cool.dev --slug authproxy --output json
   ```

   `NEON_AUTH_ORIGIN` is the Auth URL without its path. The second command answers with a
   `cname_target`.
3. **Its subdomain.** At Open Domains, a `CNAME` from `auth.leo-os.is-cool.dev` to that target, DNS
   only too. `neon functions domains list --output json` says `active` once the certificate is
   issued; `https://auth.leo-os.is-cool.dev/<database>/auth/get-session` then answers `null`.
4. **Neon Auth.** Add `https://leo-os.is-cool.dev` to its trusted domains.
5. **This repository.** The variable `NEON_AUTH_URL` becomes the function's domain with the Auth
   URL's path: `https://auth.leo-os.is-cool.dev/<database>/auth`. Run `deploy.yml` on `main` again.

On the iPhone, the old icon goes and the new address is added again. Whatever stays on the device
only — the wallpaper, WillChat's conversation — belongs to the old origin and does not come along.
Safari caps the cookies of a subdomain that points at another provider to seven days, renewed each
time the session is, so an app left unopened for a week asks to sign in again. For `pnpm dev`,
`.env` keeps the Auth URL as it is: the function only answers the published site.

## Deploy

Everything is published to the `gh-pages` branch, which is the only thing GitHub Pages serves:

| What is pushed | Where it lands         | URL                                  |
| -------------- | ---------------------- | ------------------------------------ |
| `main`         | the root of `gh-pages` | `…github.io/leo-os/`                 |
| any other branch | `previews/<branch>/` | `…github.io/leo-os/previews/<branch>/` |

On an [own domain](#own-domain), the same without `/leo-os`: `https://<domain>/` and
`https://<domain>/previews/<branch>/`.

`deploy.yml` runs on every push: it passes `pnpm check`, brings the database up to date if this is
the default branch (or gives a preview its own copy of it), builds with the base path it is due and
`scripts/publish-pages.sh` writes the result into `gh-pages`. Publishing the site does not wipe the
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
- When the branch is deleted, `preview-cleanup.yml` drops its folder and its schema. Once none are
  left, `previews/` disappears. GitHub runs that workflow from `main`, so the cleanup starts working
  once the file lands there.
- GitHub Pages takes about a minute to serve what was just published.

Each preview has a database of its own: a schema in the same Neon database, named after it
(`preview_claude_wizardly_euler`), which `db/preview.mjs` keeps up to date. A push that finds none
— the branch's first, or the next one after a run that did not get to finish — makes it a copy of
`public` as it is at that moment (tables, rows, functions, policies and grants), with the branch's
own migrations applied on top. Every push after that keeps it, rows included, and only
applies the migrations it brings: a branch that adds a column can be tried before it is merged,
with whatever was typed into the preview still there. The Data API serves every preview's schema
next to `public`; the preview's queries name theirs, and the published site's name none, which keeps
them on `public`.

- Nothing done in a preview reaches the published data.
- Which migrations a preview's schema has is its own log, `drizzle.<schema>`, next to `public`'s.
  A migration counts as new until the schema has it, whatever its date: the ones main brings over
  when it is merged into the branch are applied too.
- A migration the preview has applied and the branch then changes or drops leaves the schema with
  nothing to follow: that push copies `public` again, and the run summary says why.
- A migration of the branch older than the last one `public` has is refused: drizzle only applies
  what is newer, so `pnpm db:migrate` would skip it on main for good. Generating it again, once
  main is merged into the branch, puts it last.
- To start a preview's data over, drop its schema — `pnpm db:preview drop <name>`, or from the Neon
  console — and push: the next push copies `public` again.
- The copy holds every account's rows behind the same policies: each account sees only its own
  there too.
- Each push is one transaction, and `public` is only read: a migration that fails leaves the schema
  as the push before left it, and the run fails with it. A migration may name `public` the way
  drizzle-kit writes it, which the preview points at its own schema, but not change the
  `search_path`.
- It needs `NEON_API_KEY` and `NEON_PROJECT_ID` ([Setting it up](#setting-it-up)): the Data API is
  told what to serve through the Neon API. Without them the preview uses the published data, as the
  run summary says.

A preview lives on the same origin as the published site, so it shares the session, `localStorage`
and IndexedDB with it: it opens already signed in, with the same wallpaper and the same WillChat
conversation, which never reach the database. The copy of its rows each app keeps on the device is
the preview's own.

## Home screen icon

Safari will not take an SVG for the icon saved with «Add to Home Screen»: without a PNG, it saves a
screenshot of the page instead. That is why `scripts/icons.mjs` turns each `icon.svg` into a
180 × 180 `apple-touch-icon.png` inside the project's `static/`, and each `app.html` links it with
`<link rel="apple-touch-icon">`. The PNG is generated at build and install time; it is not
versioned, so the SVG stays the only source.

The icon has to be opaque and reach the edges: iOS applies its own rounded mask and paints anything
transparent black. Safari also caches the icon eagerly; if the old one keeps showing up while
testing, close the tab and open the page again.

The home screen, and every page that shows an icon, draws the SVG itself in an `<img>`. There,
Safari renders whatever goes through an SVG `filter` or `mask` at low resolution, which comes out
blurry on an iPhone's 3x screen. So nothing in an icon that should look sharp goes through either:
a drop shadow or a glow is a blurred copy of the shape, drawn underneath it, and a cut-out is a
`clipPath`.

## Home

Besides the published apps, the home screen carries three icons of its own. They live in the dock
at the bottom, which stays put whichever page of apps is showing, and go without their names there,
as on iOS:

- **Ajustes**: the wallpaper, the theme and the colour of the status bar, and which account is
  signed in with the way out.
- **Recargar**: reloads the site, handy when it runs full screen without browser controls.
- **Cerrar sesión**: signs out, after asking.

Added to the home screen, the dock floats 12 points over the bottom edge, as the iOS 26 one does.

In Ajustes:

- **Fondo de pantalla**: the chosen photo is scaled down to 1600 px, re-encoded as JPEG and stored
  in the browser's `localStorage` under `home:wallpaper`, one per account. With no photo, the
  default gradient is used, which comes back on «Quitar».
- **Apariencia**: light, dark, or «Sistema», which follows the device. It is the home screen's and
  every app's at once, kept in the account as `leo-os:theme`: each project writes its colours with
  `light-dark()`, and `Account` puts the theme picked on `<html>` as `data-theme`.
- **Barra de estado**: the colour of the band iOS leaves at the top, at the height of the camera,
  when the site runs from the home screen. It is picked from the grid of iOS's colour picker, or by
  red, green and blue, slid or typed as a code (`#1C1446`, `28, 20, 70`), and previewed at the top
  of that page. It is kept in the account as `home:status-bar-color`; «Usar el predeterminado» goes
  back to the site's own. The band takes it once Ajustes closes — while it is open, the band keeps
  the colour it had — and on opening, once the session is confirmed: until then it is the purple of
  the door.

iOS 26 does not colour that band with `theme-color`. WebKit takes the plain `background-color` of the
fixed element at the top edge, and reads it again whenever it changes only while that element is
shorter than the screen: one that fills it — the door `Account` shows while loading, the home
screen, an app's frame — keeps whatever colour the band already had, so the door's purple would stay
for good. That is why `Account` keeps an invisible strip along the top edge, above everything, in
the project's `--status-bar`, or else its `--bg`: the home screen sets the first to the colour
picked here, and in every app the band is the page's own background, following the theme.

## WillChat

A ChatGPT-style chat for creating and editing images with the OpenAI API and your own API key.

- The API key is stored in your account, where the policies let no one else read it, and is only
  ever sent to `api.openai.com`. Keeping it there is what saves entering it again on every device.
- The text and image models are chosen by tapping the title. The list comes from `/v1/models`, and
  any ID can also be typed in.
- Photos are scaled down to 2048 px and sent as `input_image`. Every turn sends the whole
  conversation, generated images included, so the model can keep editing them.
- The microphone to the left of the send button dictates. Tapping it starts listening; tapping it
  again, now a ✓, turns what was said into text and adds it to the message, to be read over before
  sending, and ✕ throws it away. It also stops and transcribes on its own after three minutes, or
  when the app goes to the background.
- Dictation goes to Groq's `whisper-large-v3`, the same model as Lista, with the same Groq API key:
  the one saved as `groq:api-key`, which every app here that uses Groq reads, so a key entered in
  Lista already works here. Without one, the microphone opens the settings to enter it. Whisper is
  told to expect the app's own language, Spanish or English, and the segments it doubts were speech
  are dropped, as in Lista. The key and the recordings are only ever sent to `api.groq.com`.
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

## Lista

A checklist that is only ever edited by voice: dictate a list and every thing in it becomes an item
with a box to tick, then say what to change.

- Tapping the microphone starts listening and tapping it again sends what was heard; **Cancelar**
  throws it away. It also stops and sends on its own after three minutes, or when the app goes to
  the background. While listening, the screen is kept on and a ring around the button follows the
  voice.
- What was said goes to Groq twice: `whisper-large-v3` turns the recording into text, and
  `openai/gpt-oss-120b` decides what that text does to the list. The model is shown the list
  numbered as it is on screen and can only answer with actions — add, edit, remove, check, uncheck,
  clear, undo — that Groq's strict mode holds to a JSON schema. An action pointing at an item that
  is not there is dropped.
- «Leche, huevos y pan» adds three items; «quita el pan», «cambia la leche por leche deslactosada»,
  «ya compré los huevos» or «empieza una lista nueva» change the list. There is only ever one list:
  a new one replaces it.
- The bar at the bottom shows what Whisper heard and what the model did. **Deshacer**, or saying
  «deshaz eso», takes back the last voice command, leaving alone any box ticked since.
- Boxes can also be ticked by tapping them. Everything else goes through the microphone.
- Out of silence Whisper makes up phrases such as «Gracias.» or «Subtítulos realizados por la
  comunidad de Amara.org»; the segments it doubts were speech are dropped before the model sees
  them.
- It needs a Groq API key of its own: WillChat's is an OpenAI key, which Groq does not take, and the
  app refuses a key that looks like one rather than send it there. The key is stored in the account
  like WillChat's and only ever sent to `api.groq.com`, together with the recordings. It is saved as
  `groq:api-key`, with no app's prefix: every app here that uses Groq reads that same one.
- The list lives in the `lista_items` table, one row per item, with a copy on the device so the app
  opens without waiting. Coming back to the app reads it again, in case it changed on another device.

## Repaso

Flashcards studied with spaced repetition, the way Anki does it: decks of cards, each card shown
again just before it would be forgotten.

- The first screen lists the decks, in alphabetical order, with how many cards each has waiting
  today; **Nuevo mazo** adds one, and **Mazos de AnkiWeb** brings one of the decks the Anki
  community shares. A deck shows how many of its cards are new today, how many are due again and how
  many there are in all, the button to study them, and its cards, newest first, with when each comes
  up next: the first 200, and the rest on request. Tapping a card corrects or deletes it;
  **Editar** renames the deck, sets how many new cards a day it brings, or deletes it with all its
  cards.
- The back button and the back gesture walk back through the screens. Which one is showing lives in
  the history entry rather than in the URL, so a reload lands on the list of decks.
- Cards are added by hand — **Añadir tarjeta**, a front and a back; the sheet stays open for the
  next one, and ⌘/Ctrl + Enter adds it from the keyboard — or written by AI with **Generar con IA**.
- Studying shows the front; **Mostrar respuesta**, or tapping the card, turns it over. The answer is
  one of four buttons, each saying when the card will come back: **Otra vez**, **Difícil**,
  **Bien** and **Fácil**. On a keyboard, Space turns the card and then counts as «Bien», 1 to 4 are
  the four answers and Esc ends the session. The pencil corrects the card being studied, which is
  where a mistake in one the AI wrote shows up.
- The schedule is Anki's classic one (SM-2) with its default settings, in `src/lib/schedule.ts`. A
  new card is learned in steps of one and ten minutes and comes back the next day, or in four days
  with «Fácil». From then on «Bien» multiplies the interval by the card's ease, which starts at
  2.5; «Difícil» lowers the ease and «Fácil» raises it. A forgotten card is relearned in ten minutes
  and starts over at a day. The day turns over at 4 a.m., so a session past midnight still belongs
  to the day before.
- A session goes through what is due in this order: the cards being learned whose time has come,
  the reviews, the new cards in the order they were added, and last the cards being learned that
  come due within twenty minutes, shown early rather than waited for. It ends when nothing is left,
  which leaves every card it touched learned.
- A deck may cap the new cards a day, as Anki does: **Nuevas al día**, under **Editar**. One written
  by hand or by the AI has no cap, so its cards are studied the day they are added; an imported one
  starts at Anki's 20, having thousands. A card counts towards the day it is first answered, and
  once the day's are done the deck says how many come tomorrow.
- **Generar con IA** asks Groq for 5, 10 or 20 cards about whatever is written in: a topic, a list
  or notes pasted in. The model is picked there, among the chat models the key can use (Groq's
  `/models`, without speech, voices, safety classifiers or agent systems), and remembered in the
  account; until another is picked it is `openai/gpt-oss-120b`. Next to it, **Idioma** says whether
  the cards are written in Spanish or English, whatever the topic or the notes are in; it is
  remembered too. The model is shown the deck's name and its cards, so that it does not repeat
  them, and whatever it writes that the deck already has is dropped anyway. Before anything is added, any card can be
  left out with a tap; the cards written stay there until added or discarded, even if the sheet is
  closed.
- Groq holds some models to the cards' JSON schema token by token (strict mode) and not others, and
  which ones changes as models come and go. So every model is asked for strict mode first, and one
  that turns it down is asked from then on for a plain JSON object, with the prompt spelling out its
  shape. Nothing model-specific is sent, not even reasoning settings, so the app need not know a
  model to use it.
- It uses Lista's Groq API key, `groq:api-key`: entered once, in whichever of the two apps comes
  first, and asked for here the first time cards are generated. Only the key and what is asked for
  — the topic or notes, the deck's name and the front of its cards — are ever sent to
  `api.groq.com`.
- **Mazos de AnkiWeb** brings decks from [AnkiWeb's shared decks](https://ankiweb.net/shared/decks).
  AnkiWeb lets no other site read what it serves — it sends no CORS headers — so searching and
  downloading happen on AnkiWeb itself, in the browser: the search box, or one of the topics under
  it, opens AnkiWeb's results, and a deck's «Download» saves an `.apkg` file, which **Elegir el
  archivo .apkg** opens here. A file can also be dropped on the sheet. After a few downloads AnkiWeb
  asks to sign in with an account of its own, which is free.
- The file is read in the browser, and nothing of it leaves but the cards. `src/lib/anki/` unzips
  only the collection inside, an SQLite database — never the images and audio, which can be
  hundreds of megabytes — and reads it, with no library for either. What comes in is text: each
  card's front and back are what Anki's templates render (fields, sections, cloze deletions, type-in
  answers, hints, furigana), read as a browser would show them, without what the note type's CSS
  hides, its scripts, its images or its audio. The answer drops the lines every card has alike —
  credits, dashes, the label of an empty field — and the question when it repeats it. Cards whose
  question is only an image or a recording, or that have no answer, are left out, and the preview
  says how many, next to a few of the cards, the deck's name and its new cards a day, to change
  before importing. The deck and its cards reach the database 500 cards to a request.
- AnkiWeb hands out its decks in Anki's older formats. A package exported by Anki itself in the
  newest one (`collection.anki21b`) is compressed with zstd, which browsers cannot uncompress: it
  is turned down, with the way out — exporting it again with «Support older Anki versions».
- Decks and cards live in the account, in the `repaso_decks` and `repaso_cards` tables, each card
  with its place in the schedule in plain columns, and with a copy on the device so the app opens
  without waiting. Coming back to the app reads them again, in case they were studied on another
  device. The copy is written a second after the last change, or as the app goes to the background,
  so that no answer waits for thousands of cards to be copied; and a collection too large for the
  few megabytes of localStorage the whole site shares — thousands of cards, as an imported deck
  brings — is not kept on the device at all, and is read from the database every time.

## Dictado

Voice to text: say something and it is written down, then go on dictating, or say what to change.

- It opens on the microphone and the **Mejorar texto** switch. Tapping the microphone starts
  listening and tapping it again, now **Listo**, turns what was said into text; **Cancelar** throws
  it away. It also stops and goes on on its own after ten minutes, or when the app goes to the
  background. While listening, the screen is kept on and a ring around the button follows the voice.
- From then on the text takes most of the screen, and can be typed in as well. **Añadir** dictates
  more, which goes at the end: a stretch of speech follows on from the text, and anything in several
  lines — paragraphs, a list — starts a paragraph of its own. **Editar** listens for an instruction
  instead, such as «hazlo más formal», «quita la última frase» or «tradúcelo al inglés», which the
  chat model carries out on the whole text.
- **Deshacer** and **Rehacer** walk through every version the text has had since the app was opened:
  dictated, improved, edited or typed, where typing counts as one change until it pauses. ⌘Z and ⇧⌘Z
  (Ctrl on the others) do the same. The versions last as long as the visit; the text is kept.
- With **Mejorar texto** on, every dictation also goes through the chat model, with the instructions
  under **Instrucciones**, which are the user's to rewrite, and what comes back takes the place of
  the transcription. The transcription is on screen first and Deshacer goes back to it; if improving
  it fails, it stays. The model is shown the end of the text so far, to follow on from it, and only
  what goes after it comes back.
- Typing on a touch screen, the bar with the microphones steps aside for the keyboard, and the top
  one has Deshacer, Rehacer and **Listo**. The copy button copies the whole text, and **Texto nuevo**
  empties it after asking; Deshacer brings it back.
- **Ajustes** picks the speech-to-text model among those Groq's `/models` lists (`whisper-large-v3`
  until another is picked; `whisper-large-v3-turbo` is the faster one), the language Whisper is told
  the dictation is in — Spanish, English, or «Automático» for Whisper to work it out — and the chat
  model that improves and edits, `openai/gpt-oss-120b` until another is picked. It is plain text in
  and plain text out, with nothing model-specific sent, so any chat model the key can use will do.
  These choices, the switch and the instructions are kept in the account.
- Out of silence Whisper makes up phrases such as «Gracias.»; the segments it doubts were speech are
  dropped, as in Lista.
- It uses the same Groq API key as Lista and Repaso, `groq:api-key`, and asks for one when there is
  none. Only the key, the recordings and the text are ever sent to `api.groq.com`.
- The text lives in the account, in the `dictado_texts` table, one row per account, with a copy on
  the device. A change is saved a moment after it is made, and until the database has it the copy on
  the device says so: the next time the app opens, that copy is sent rather than read over, so a
  dictation is not lost to a moment without signal. Coming back to the app reads the text again, in
  case it changed on another device.

## Leogram

A parody of Instagram: carousel posts with a song, each with a link that opens for anybody, signed in
or not.

- Opening it shows the account's profile as Instagram has one: its photo, its username and its posts
  in a grid of three, and «+» to write a new one. The first time, it asks for the username its posts
  and comments will carry, suggested out of the account's name; «Editar perfil» changes it and the
  photo later. Usernames are Instagram's: lowercase letters, digits, dots and underscores, and no two
  accounts share one.
- A post is up to ten photos, cut to one of Instagram's shapes — 1:1, 4:5 or 1.91:1, whichever crops
  the first photo least until another is picked — and framed by dragging each one. They are kept
  1080 pixels wide, as JPEG; the arrows and the bin under them reorder them and drop one. Then a
  caption and a song.
- **The song** comes from Apple's catalog or from the device. The catalog is Apple's open search
  (`itunes.apple.com/search`), which needs no key: any song anyone knows, with the 30-second preview
  Apple serves of it, which the post plays from Apple. From the device, an MP3 (or anything else the
  browser can play). Either way the song is drawn as bars, and its moment is picked by dragging the
  lit-up stretch or tapping where it should start: up to 30 seconds, which start over at the end for
  as long as the post is open. A song from the device starts out on its loudest 30 seconds, more
  often than not its chorus.
- Only that moment of a song from the device is kept, never the whole song. `src/lib/music/mp3.ts`
  cuts it out of the MP3's frames byte for byte, so it sounds exactly as the song did, with nothing
  decoded or encoded. What is not an MP3 is decoded and kept as a WAV of one channel at 22 kHz,
  which is what a browser can write by itself.
- **«Compartir» publishes it, and its link is ready right away** (`…/leogram/?p=<code>`): there is no
  other step to make it public. Nobody comes across a post without its link, whose code is eleven
  random characters, and nothing lists posts but their author's own grid. The link is copied or
  shared from there, from the post's «⋯», or from the paper plane under it.
- **The link opens for anybody**, with Leogram's name on top as Instagram has its own: the photos to
  swipe through, the song, who posted it, the likes, the caption and the comments. A browser lets no
  page make sound before it is touched, so when the song cannot start on its own it says so on the
  photo, and starts with the first tap anywhere.
- **Liking and commenting take an account.** Signed out, the heart, a double tap on a photo or the
  comment box put up the same door as every app of Leo OS, with «Ahora no» to go back to the post;
  once signed in, the like is given, or the box is ready. An account's first comment gives it a
  Leogram username out of its name. A comment can be deleted by whoever wrote it and by the post's
  author, and a post by its author, which takes its photos, song, likes and comments with it.
- Everything lives in the database, since it is meant for others: `leogram_profiles`,
  `leogram_posts`, `leogram_media` (each photo and song as a data URL, sent in parts of under a
  megabyte), `leogram_likes` and `leogram_comments`. The author's grid reads only `leogram_posts`,
  which carries a small copy of each post's first photo, and keeps a copy of it on the device.
- **How a link opens with no account.** The Data API turns away a request with no token, so a
  visitor's page asks Neon Auth for the anonymous token it hands anybody (`/token/anonymous`), which
  the Data API runs as the `anonymous` role. That role reaches no table: all it may do is call
  `leogram_post(code)` and `leogram_file(code, slot)` (`db/migrations/0007_leogram_public.sql`),
  which run as their owner and hand over the one post whose code they are given, never a list. Signed
  in, the same two also say whether the post is one's own and whether one liked it. It takes the Data
  API's anonymous role to be `anonymous`, which is its default.
- A post of ten photos and a song takes up to some 4 MB of the database, and every visit downloads
  it; Neon's free plan keeps half a gigabyte per project. A song from Apple takes nothing: it plays
  from Apple.
- Apple is sent what is typed in the search box, and serves its previews and covers to whoever
  plays them; the photos, the songs from the device and everything else go nowhere but the
  database.
