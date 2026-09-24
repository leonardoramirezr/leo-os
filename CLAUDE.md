# CLAUDE.md

Working notes for Claude Code in this repository. `README.md` explains the project; this file only
covers what working on it requires and the code does not already say.

## Always return the preview link

**Every reply that changes what the apps (`apps/`) or the home screen (`home/`) show must end with
the link to the preview of that change.** The same goes for any other change that alters what is
published, `scripts/build.mjs` for instance.

The link only exists once the change is committed and pushed: `deploy.yml` publishes the preview on
every push. The order is always commit → push → link. The URL comes from the branch name:

```sh
slug=$(scripts/preview-slug.sh "$(git rev-parse --abbrev-ref HEAD)")
echo "https://leonardoramirezr.github.io/leo-os/previews/$slug/"
```

Link the home screen, plus the direct path of each app that was touched — an app lives at
`<preview>/<app folder>/`:

> **Preview of this branch**
>
> - Home: https://leonardoramirezr.github.io/leo-os/previews/claude-add-claude-md-file-rxd793/
> - Me deben: https://leonardoramirezr.github.io/leo-os/previews/claude-add-claude-md-file-rxd793/me-deben/
>
> GitHub Pages takes about a minute to serve the change.

- On `main` there is no preview: the link is the published site,
  `https://leonardoramirezr.github.io/leo-os/` (and `…/leo-os/<app>/` for an app).
- If the push has not happened yet, or the workflow failed, say so instead of handing over a link
  that will 404.
- A change that does not touch what is published (documentation, comments, this file) needs no link.
- Every live preview is listed at `https://leonardoramirezr.github.io/leo-os/previews/`.

## Everything in English

Comments, documentation, markdown and the names of variables, functions and classes are written in
English, this file included. The only Spanish is what the user reads on screen: the apps' own UI
text, which stays as it is (WillChat is bilingual, with its strings in `src/lib/i18n.ts`, so new
text there goes in both languages).

## Keeping this file

On every change, consider whether this file still holds — and prefer leaving it alone. It is meant
to stay minimal: anything the code already makes obvious does not belong here, and anything about
the project rather than about working on it belongs in `README.md`. Changing nothing is the normal
outcome; a rule earns its place here only by being one that would otherwise be got wrong.

## The repo

Static web apps (SvelteKit + Svelte 5 in runes mode) published together on GitHub Pages at
`https://leonardoramirezr.github.io/leo-os/`. The home screen mimics an iPhone home screen: every
app is an icon. Everything renders on the client and **there is no backend of ours**: an app signs
in with Neon Auth and queries its own rows in Neon straight from the browser. Images stay in the
browser's `localStorage` or IndexedDB. `README.md` explains the whole of it under «Account and
data», including what has to be set up in the Neon console.

```
home/            The home screen
apps/<slug>/     One folder per app; the slug is part of the URL
shared/          The account and the database; every project depends on it
db/              The models (schema.ts) and the migrations generated from them
scripts/         build, icons, local preview, and publishing to the gh-pages branch
.github/workflows/  deploy.yml on every push, preview-cleanup.yml when a branch is deleted
```

## Commands

Node 24+ and pnpm (`packageManager` pins the version).

```sh
pnpm install
cp .env.example .env           # where Neon is; without it every screen says there is no database
pnpm --filter me-deben dev     # one app
pnpm --filter home dev         # the home screen
pnpm check                     # svelte-check across every project, and the models against the migrations
pnpm icons                     # regenerates the apple-touch-icon.png files after editing an icon.svg

pnpm db:generate               # writes the migration for what changed in db/schema.ts
pnpm db:migrate                # applies the pending migrations to DATABASE_URL

BASE_PATH=/leo-os pnpm build   # the whole site, as it gets published
BASE_PATH=/leo-os pnpm preview # http://localhost:4173/leo-os/
```

**`pnpm check` has to pass before pushing**: `deploy.yml` runs it before building, and a failure
leaves the branch without a preview.

## An app's contract

Every folder in `apps/` is published at `<BASE_PATH>/<folder>/`, and the home screen discovers it at
build time (`home/src/lib/apps.ts` globs the `app.json` and `icon.svg` files): there is nowhere else
to register it.

- `app.json` with `{ "name": "Visible name" }`, and a square, full-bleed, opaque `icon.svg` — the
  home screen and iOS apply the rounded mask themselves.
- A `build` script that writes `build/index.html`, with `paths: { base: process.env.BASE_PATH ?? '' }`
  in `vite.config.ts` and `ssr = false` + `prerender = true` in `src/routes/+layout.ts`.
- `@leo-os/shared` as a `workspace:*` dependency, and a `+layout.svelte` that wraps
  `{@render children()}` in its `<Account load={…}>`: nothing of the app draws until there is an
  account and its rows have been read.
- The folder name is part of the URL: lowercase letters, digits and dashes only.

## Conventions

- **Formatting**: tabs, single quotes, semicolons, lines up to ~110 columns. There is no Prettier
  config: match the files around you.
- **Comments** explain why, not what — especially the iOS and Safari quirks behind several
  decisions here. Read them before "simplifying" something.
- **Storage**: data goes to Neon through `shared/` — `setting(…)` for a preference, a table of its
  own for anything bigger — and every row carries the account it belongs to. Only images stay on
  the device (`local(…)`, IndexedDB), under keys that carry the account too, and every read and
  write of those is wrapped in `try`/`catch`: the browser may have site data blocked. Keys keep
  their app's prefix either way (`home:wallpaper`, `me-deben:*`, `willchat:*`), except what several
  apps share: the Groq API key is `groq:api-key`, and any app that talks to Groq reads that one.
- **A change to the database starts in `db/schema.ts`**, never in the database and never in a
  migration by hand: edit the models, run `pnpm db:generate`, and commit the migration it writes
  next to them. The row types the apps use come from the same models. `pnpm check` fails when the
  two have drifted, and leaves the missing migration behind for you to read.
- **Only the default branch migrates**, so a branch that needs a new column has to be merged before
  its preview works. Grants are the one thing the models do not carry: they live in
  `db/migrations/0001_grants.sql`, which covers the tables of every migration still to come.
- **Dependencies**: as few as possible. No UI or styling frameworks; CSS is written by hand inside
  each component.
- **Nothing leaves the browser** but the user's own data, to the user's own database, and what they
  asked for: no telemetry, nobody in the middle (WillChat talks straight to `api.openai.com` with
  the user's own key).
- The `apple-touch-icon.png` files are generated, never committed. `icon.svg` is the only source.

## Commits

The area first, then what changed — the shape the history already uses. New messages are written
in English, like everything else, even though the older ones are in Spanish:

```
Me deben: correct a movement after recording it
Home: new site icon
```

Work on the branch the task names, never straight on `main`, and do not open a PR unless asked.
