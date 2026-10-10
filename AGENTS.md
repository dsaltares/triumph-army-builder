# AGENTS

Army builder for the Triumph! historical miniature wargame.
TS (strict), Yarn 4, Node 24, Next.js 16 App Router, React 19.

## Commands

- `yarn dev` — dev server on 3013 · `yarn build` · `yarn start`
- `yarn typecheck` · `yarn lint` · `yarn format` · `yarn test` · `yarn test:e2e` — the suite
  against a production build of its own (`next build` then `next start`), in `.next-e2e` on 3099,
  never a server already running; `E2E_PORT` moves it when another worktree holds 3099.
  `yarn test:e2e:dev` runs it against `next dev` instead, for hot reload while writing a spec — it
  is slower and flaky under parallel workers (a manifest read mid-write, routes compiling on their
  first request), so trust only a production run
- `yarn test` runs the `unit` project under coverage, then the `ui` project; `yarn test:watch`
  runs both. `vitest run --project ui <path>` narrows to one file. Neither reads `data/`.
- `yarn test:real-data` runs the `real-data` project: every `*.real-data.test.ts` under
  `real-data/`, the tests that only mean something against the real snapshot. `data/` and
  `real-data/` live in the private data repo, `dsaltares/triumph-army-builder-data`, whose CI
  copies them into a checkout of this repo and runs the project there.
  The directory mirrors the tree it tests and imports only through `@/`.
- `yarn check:restricted [--tracked] [--exclude <prefix>] [--baseline <file>] [--update-baseline]
  [paths]` — look for every army name and battle card line in the snapshot, and every line of the
  Fantasy Triumph card text in the curation, across the files
  under `paths` (git-tracked ones with `--tracked`) and exit non-zero on any the baseline does not
  hold, or on a baselined one that is gone. It needs the real snapshot, so it runs in the data
  repo's `restricted-content` workflow, over this repo's tree, its build and its image, with an
  empty baseline: a real army name or battle card line in any file here fails it. The image never
  carries `data/`: `.dockerignore` keeps it out of the build context, and `yarn build` reads no
  reference data.
- CI runs `typecheck`, `lint`, `test` and `build` as a matrix, and `test:e2e` beside it, so
  those names are fixed.
- `yarn data:sample` — rebuild `test/fixtures/reference/sample-pack.json` from the sample
  snapshot, curation and translations beside it
- `yarn db:migrate` — apply outstanding database migrations · `yarn db:migrate down` rolls one back
- `yarn db:seed` — add a signed-up, confirmed `dev@example.test` / `triumph-dev-password` to the
  local database if it is not there yet; `yarn dev` runs it after `yarn db:migrate`, and it
  refuses to run under `NODE_ENV=production`
- `yarn db:seed:reference` — make the data version `reference-version.txt` pins current in the
  local database, doing nothing when it already is; `yarn dev` runs it after `db:seed`. It seeds
  `REFERENCE_PACK` when that names a pack, and otherwise takes the pinned pack from
  `~/.cache/triumph-army-builder/reference/`, then from release `data-<version>` of the data repo
  (`dataRepository`, `dsaltares/triumph-army-builder-data`) with `REFERENCE_PACK_TOKEN` (the
  environment, then `~/.config/triumph-army-builder/env`) or `gh auth token`, and falls back to
  the sample pack. It refuses to run under `NODE_ENV=production`
- `yarn db:sweep` — delete the anonymous records and unopened share links retention has caught up
  with, and reconcile `PHOTO_DIR` against `collection_photos` (the server does both daily on its own)
- `yarn data:pack [--snapshot <dir>] [--curation <dir>] [--translations <dir>] [--out <file>]` —
  validate the snapshot and the curated overlays, and write every locale's bundle files into one
  reference pack (ADR 0035), `.data/reference-<dataVersion>.json.gz` unless `--out` names another
  file; the directories default to `data/`, which only a checkout of the data repo has. A
  `games/fantasy/` directory in the curation adds the Fantasy Triumph section (ADR 0039, ADR
  0040); a pack without one still imports, and `reference.games` then offers Triumph! alone
- `yarn data:bump [--snapshot <dir>] [--curation <dir>]` — stamp `release.json` in the curation so
  the next pack carries a new data version though the snapshot has not changed, which is how a
  change to the curation or the translations alone ships (ADR 0042) · `yarn data:version` prints
  the version a pack would carry, which the data repo's release workflow names its release after
- `yarn db:import-reference <path|url> [--rollback-to <version>]` — write a reference pack into
  the database in one transaction and make its version current, doing nothing for a version it
  already holds; `--rollback-to` makes an imported version current again (ADR 0034)
- `yarn db:backup` — copy the database with SQLite's online backup into `backups/` beside it
  (`BACKUP_DIR` overrides), keeping the last ten; the image carries it as `backup-database.ts` for
  the deploy to run in the container, so it imports nothing from `lib/`
- `yarn db:copy-down` — replace the local database and `.env` with production's, straight over
  SSH: an online backup on the homelab and the environment the service runs with, taken with
  `ssh homelab` (`COPY_DOWN_SSH_HOST`, from the environment or `~/.config/triumph-army-builder/env`,
  names another host) in the compose project the `DEPLOY_COMPOSE_DIR` and `DEPLOY_SERVICE` repo
  variables name, so it works from any worktree. The `.env` keeps production's secrets and the
  local settings production lacks, points `BETTER_AUTH_URL` and `DATABASE_URL` at this machine,
  and drops the container's paths and proxies (`scripts/local-env.ts`). What each replaces is kept
  as `<file>.before-copy-down`; stop `yarn dev` first. The copy holds players' lists, accounts and
  sessions, and the `.env` sends real email. It refuses to run under `NODE_ENV=production`
- `docker compose up --build` — the app in a container on 3013, SQLite under `/data`

## Conventions

- **No comments.** Names carry the meaning — extract a named constant or function instead of
  explaining a line. No JSDoc on types, fields or functions either. The only exception is an
  unexplainable hack (a protocol quirk, an upstream bug the code has to work around), and then the
  comment says *why*, never *what*. Anything a reader needs that is not a hack belongs in a test
  that pins it, an ADR, `docs/` or here — not in `README.md` (see *Docs*).
- **No classes** — factory functions + closures.
- `lib/domain/` is pure TypeScript: no React, no I/O, no framework imports. It is where
  correctness lives, and the only thing coverage is measured on (90% floor).
- `lib/db/` is the only module that talks to SQLite. Migrations are an ordered map of static
  imports in `lib/db/migrator.ts`, never a directory read — `output: 'standalone'` traces modules,
  not directories. Add a migration, never edit one that has shipped. An index needs a plan, not a
  hunch: `lib/db/query-plans.test.ts` runs `EXPLAIN QUERY PLAN` over the statements the real code
  executes — ours and Better Auth's — and every index in the schema is there because it turned a
  `SCAN` on a request path into a `SEARCH` (#110). `lib/db/reference.ts` is `BundleSource` over
  the imported reference data: every version stays, one is current, and the source re-reads
  `reference_current` on each call so an import from another process lands without a restart.
  Every server reader takes its data from the database through `lib/data/served-bundle.ts`
  (#237). A page, the share image and the sheet route ask `servedReference(locale)`, which opts
  the route out of prerendering and returns the bundle with the current data version, or `null`
  when no version is current — and then a page renders `ReferenceUnavailable` rather than an
  error, and the sheet answers 503. The tRPC context takes `bundleFor`, which throws instead.
  The build reads no reference data, so no page that reads it is prerendered and none takes
  `generateStaticParams`. The current data version is never compiled in (#236): the server reads
  it with `currentDataVersion(db)` or from `servedReference`, and the client asks
  `trpc.reference.current`, which takes no session, through `components/use-current-data-version.ts`.
  The client reads reference data only through the public `reference` router, never `/data/`,
  and `useReference` in `components/use-reference.ts` pins each read to that version, so
  `responseMeta` in `lib/trpc/cache.ts` can cache a pinned batch for good (ADR 0034).
  Nothing that renders at build time may read it — the footer asks from the browser.
- `lib/auth/` is the only module that configures Better Auth. It takes the Kysely instance from
  `lib/db/`, never its own connection, and the password rules live in one place so the form and the
  server cannot disagree. An anonymous session is minted on a player's **first write** and never on
  page load, and `isSignedIn` — not the presence of a session — is what the UI asks. Mail it sends
  goes out through `lib/email/`, behind the counters in `lib/auth/rate-limit.ts` —
  `rate-limiter-flexible` behind a `{ window, max }` seam — so a public endpoint cannot spend the
  day's Resend quota. A guard on a send returns *quietly*: the endpoint answers the same whether
  mail went out or not, or the limit becomes the address oracle the flow was shaped to deny.
  `BETTER_AUTH_URL` is mandatory in production — unset, Better Auth takes its origin, and every
  link it mails, from the request `Host`.
- `lib/trpc/` is the only module that defines the API. Procedures take their database, their caller,
  their clock, their id source and their data bundle from the context, never a singleton, so a test
  can drive the real router against in-memory SQLite and a fixture bundle. The bundle is chosen by a
  `locale` the procedure takes as input, because tags match against translated descriptions. Ownership is a `where user_id = ?` on the statement, never a read
  followed by a check. Authorization is three middlewares and nothing else: `signedInProcedure`
  admits any session, anonymous included (ADR 0013), `accountProcedure` refuses an anonymous
  one with `needsAccount`, which is what everything under the collection takes (ADR 0031), and
  `adminProcedure` admits only a verified account whose email is in `ADMIN_EMAILS`, refusing
  everyone else with `NOT_FOUND` so the dashboard does not reveal that it exists (ADR 0037).
  Whether a caller is anonymous or an admin is decided there, never inside a procedure. A write
  records its `activity_events` row through `recordEvent`, in the write's own transaction, with
  the `origin` the context resolved from the request; an edit or a rename goes through
  `recordThrottledEvent`, one per list every ten minutes, so autosave does not flood the log. The
  log is read only as aggregates — nothing returns a user id, an email or an IP (ADR 0037).
  Better Auth's writes are not ours to wrap, so `lib/auth/activity.ts` records sign-up,
  confirmation, sign-in, claim and reset from its hooks once the write has landed, and logs a
  failure to record rather than failing a sign-in that already happened.
- `lib/usage/` takes the page views and filter uses the browser beacons to `POST /api/events`,
  the third API surface outside `lib/trpc/`, because `sendBeacon` posts a bare body and reads no
  answer. `usageEventSchema` in `lib/domain/usage/tracked.ts` is the closed set it accepts: a
  route template from `trackedRoutes`, which a test holds to the pages under `app/`, and a filter
  from `filterValueSchemas` — never a URL, a query, a search or a tag a player typed. The route
  resolves the session without minting one, drops bots, `Sec-GPC` and `DNT` before it looks, and
  answers `204` to everything it keeps, limits or drops alike, so a flood cannot tell the limit
  apart. The browser honours `globalPrivacyControl` and `doNotTrack` before it sends; a filter
  hook reports each value a player turns on, and `PageViewBeacon` in the root layout each path.
- `lib/email/` is the only module that sends mail. `sendEmail` takes a rendered message and
  returns a result; it never throws. Templates render to HTML and text before a transport sees
  them, so a transport never imports React.
- `lib/export/` renders a saved or drafted list to a file or to the clipboard. Each game's module
  decides what goes on its sheet and returns plain data — `armySheet` in
  `lib/domain/army/sheet.ts`, `fantasySheet` in `lib/domain/fantasy/sheet-data.ts`; the
  `@react-pdf/renderer` document for that game under `components/export/` only draws it, and
  `list-text.ts` writes the same sheet out as plain text, Markdown or BBCode (#48) — a new field on
  a sheet belongs in both or in neither. The games share the page furniture in `sheet-parts.tsx`. The PDF route at `app/api/lists/sheet` — `app/api/armies/[id]/sheet` stays as an alias
  for links already minted — is one of two API surfaces outside `lib/trpc/` — tRPC returns JSON envelopes, and a download wants bytes and a
  `Content-Disposition`. The collection's photo routes under `app/api/collection/photos` are the
  other, for the same reason in both directions (ADR 0031). It takes a share code and nothing else: no database, no session, so no
  ownership to get wrong (ADR 0020). `armySheetResponse` takes its bundle source as a parameter, so
  a test drives it over `memoryBundleSource` from `test/bundle-source.ts`. It takes the game from
  the code, reads that game's reference with `readGameData` in `lib/data/game-reference.ts`, and
  asks the registry in `lib/domain/games/` for the sheet, as the share page, the saved view and
  the saved-lists table do (ADR 0039). A surface that draws a list switches on its `game` to pick
  that game's renderer — `listSheet`, `listText`, `listSheetDocument`, `SharedListView` — and the
  types make every switch exhaustive, so a new game fails to compile until each one draws it. Each game's builder lives
  at `/<game>/build`, opened on `?list=<id>` or `?s=<code>`; `/armies/<id>/build` stays as the
  Triumph! entry from an army page and for every link already minted. Sheet colours are hex in `pdf-theme.ts` because react-pdf
  cannot read `oklch()`, Tailwind or CSS variables.
- `lib/qr/` is the only module that encodes a QR code. `encodeQr` returns a version, a module
  count and an SVG path with the quiet zone baked in; the two components that draw it —
  `components/share/list-qr.tsx` and `components/export/sheet-qr.tsx` — decide nothing beyond size.
  It encodes the **short link** and never the ADR 0010 share code, which is unreadable at print
  size, and it is dark-on-light in both themes because scanners fail on inverted codes (ADR 0022). `ListQr` is reached through `React.lazy` so the encoder stays out of the
  initial payload. **`?share=<id>` is the only thing that puts a QR on the sheet**, so a new way
  into the PDF mints the short link first: `useSheetExport` in `components/export/` is the one
  place that does it, and a menu item that exports a sheet is a button, never a link.
- `lib/share/` turns a short link into a page. `loadSharedView` takes its database and its bundle
  as parameters, the way `lib/export/` does, so the page at `/s/[id]`, its `opengraph-image` and
  the tests all drive one loader; what it assembles — the sheet, the validation report and the
  points meter — is pure and lives in `lib/domain/army/shared-view.ts`. `loadSavedView` assembles
  the same view over a saved row for its owner's read-only page at `/my-armies/[id]`, and mints no
  share (ADR 0030). A share is a **copy**: the
  row is named by a hash of its own content, nothing points back at the `armies` row it came from,
  and it outlives its author (ADR 0021). It does not outlive being forgotten: `loadSharedView`
  stamps `last_seen_at`, and the retention sweep deletes a copy nobody has opened for 24 months
  (ADR 0025). A read path that writes is the exception, so the stamp is throttled to a day and the
  loader takes a clock.
- `lib/domain/collection/` decides how much of a list a collection covers (ADR 0031). An entry is
  a batch of stands that fields as one troop type; the troop type decides whether it may
  fill a troop option, and its tags against the option's description decide whether it is a
  *match* or a *stand-in*. Coverage is a min-cost flow over one list at a time, computed and never
  stored, so one entry serves any number of lists and is never reserved. The reverse lookup —
  which armies a collection can build — runs over every army on the server in
  `collection.buildable`, and opening a result shows an unsaved view at `/collection/preview`
  whose **Edit** creates the named list (ADR 0032). A pin is kept against the
  saved list, never in its selection, because the selection travels into share codes and copies.
- `lib/photos/` is the only module that imports `sharp` or touches `PHOTO_DIR` (ADR 0031). It
  re-encodes every upload itself — the client's bytes are never stored — and takes its directory
  as a parameter, so a test drives it over a temporary one. A photo is a file on the volume and a
  `collection_photos` row; the row is the source of truth and the retention sweep removes a file
  that has none. The two routes are thin: `uploadPhotoResponse` and
  `servePhotoResponse` take their caller, database, store, quota and rate limiter as parameters,
  so their tests drive the real handlers. An upload writes the files, then places the row in a
  transaction that re-checks both quotas, and removes the files if it lost the race.
  The browser shrinks a photo before it goes up — `shrinkPhoto` in `components/collection/`,
  2048 px on the long edge as WebP — and falls back to the file as picked when it cannot decode
  it, because the server decides what is a photo. A test makes its image through `test/photos.ts`,
  never through `sharp` itself.
- `lib/geo/` is the only module that imports `maxmind` or opens the DB-IP Lite City database
  (ADR 0037). `lookupIp` returns a country, region and city or `null`, and never throws; a private
  or loopback address is `null` whatever the database says. `createIpLookup` takes the directory
  holding DB-IP's IPv4 and IPv6 files as a parameter, opens each once on its first lookup, and a
  test writes its fixtures through `test/mmdb.ts`. The client IP is `clientIp` in
  `lib/auth/client-ip.ts` — the address Better Auth resolves from `IP_ADDRESS_HEADERS` behind
  `TRUSTED_PROXIES`, with an IPv6 one kept whole — never a header read again. The files are
  copied into the image explicitly and kept out of the trace, because `output: 'standalone'`
  traces modules, not data files.
- `public/brand/mark.png` is the mark, and every icon in `public/icons/`, `app/favicon.ico` and
  `app/apple-icon.png` is that one file scaled onto a `#0c0a09` stone plate — regenerate them
  together, never one alone. The maskable export fills 62% of its canvas so it survives a circular
  crop. The header and the PDF masthead draw the master itself.
- `lib/brand.ts` is the one place the site name, its short name, the description and the app
  background live. `app/layout.tsx` takes the `oklch()` values for `viewport.themeColor` and
  `app/manifest.ts` takes the hex ones, because an OS parses a manifest's colours for the splash
  screen and cannot read `oklch()` (ADR 0024).
- **No `console`.** Log through pino: `getLogger('<module>')` from `lib/logger.ts`. Biome enforces
  this everywhere except `scripts/`, which are CLIs and print.
- **Warn, never block.** Validation returns findings; a list is always saveable, exportable and
  shareable.
- The privacy, terms and cookie pages are prerendered routes under `app/(site)/`, not PDFs: Google
  will not accept an embedded document as a policy URL, and requires it linked from the homepage on
  a domain verified in Search Console. `legalDocuments` in `lib/navigation.ts` is the one list the
  account menu and the footer link from.
- **Three kinds of test, and the extension picks the kind** (ADR 0016). All three live next to
  what they cover, except the end-to-end ones.
  - `*.test.ts` — Vitest `unit` project, `environment: 'node'`. Pure logic, and the modules that
    own I/O driven for real: `lib/db/` and `lib/trpc/` run the real statements and the real router
    against `createDatabase(':memory:')`, a fresh database per test. Coverage is measured on this
    project alone, which is why `yarn test` runs Vitest twice.
  - `*.test.tsx` — Vitest `ui` project, `environment: 'happy-dom'`. React Testing Library and
    `@testing-library/user-event`, through `renderUi` from `test/ui.tsx` (it wraps the nuqs testing
    adapter and the tooltip provider). Everything a player does to a component and everything it
    says back. Query by role, label and text — never by class, inline style or a fragment of
    markup. Reach for `test/api.tsx` when a component calls tRPC, reference data included: it
    serves the real router over MSW on an in-memory database, and `serveApi({ bundle })` imports
    those files as its current version (`translated` overrides them per locale). Do not stub a
    procedure.
  - `e2e/*.spec.ts` — Playwright, and only for what cannot be simulated: routing and prerendering,
    nuqs against the real History API, page titles and `metadata`, real sessions, real mail, the
    OAuth redirects, the mobile viewport, and one thin journey per area against the sample armies.
    If a test would pass with a fixture and no browser, it belongs in a `*.test.tsx`. Prefer one
    journey that walks several steps to several tests that each pay for a page load or a sign-up.
    E2e runs against its own database, `.data/e2e.sqlite`, named once in `playwright.config.ts`.
    `e2e/global-setup.ts` seeds the dev user into it and imports the sample pack, so the suite does
    not need `data/` (#240).
    A spec names sample armies and never a real one. The server lists that
    user in `ADMIN_EMAILS`, so a spec signs in as an admin with `devUser` and as anyone else with a
    fresh sign-up.
  - `e2e/mobile.spec.ts` is the whole of the `mobile-chrome` project, and nothing else runs there.
    Responsive behaviour (`hidden sm:grid`, sideways overflow) goes in that file; everything else
    runs once, on `desktop-chrome`.
  - **A section test and a view test are not the same test.** A section's own `*.test.tsx` covers
    what it renders from the props it is given and what it calls back with; the assembled view's
    (`army-builder-view.test.tsx`) covers only wiring — a choice made in one section reaching
    another section, the meter or the validation panel. If an assertion would hold with the section
    rendered alone, it belongs to the section.
  - A component whose behaviour is worth testing apart from its data loading gets split, as
    `army-builder-view.tsx` is split from `army-builder.tsx`. A UI test must not re-wire a section
    itself — drive the component the app renders, or it is testing the test.
- **Tests run on the sample pack, never on `data/`.** `test/fixtures/reference/` is an invented,
  fantasy-themed snapshot — eight armies, their ally lists, the curation and a Spanish catalogue —
  built so each trap in `docs/DOMAIN.md` §3 and each gating form in §5 has one army that shows it.
  It keeps every troop type and battle card code, name, cost and rule, because code keys on them;
  the armies, the card text and the troop type descriptions are ours. `test/sample.ts` reads it,
  `test/reference.ts` seeds it into a database with `seedReference`, and a test asserts
  `sample-pack.json` is what `yarn data:sample` builds. A test that only makes sense against the
  real data — a count, a sweep over every real army, the real overlay's coverage — is a
  `*.real-data.test.ts` under `real-data/` and reads `real-data/vendored.ts`; nothing else may
  import `data/`, and nothing outside `real-data/` and `data/` may name a real army.
- **Validate all external data with zod**, at the boundary.
- **A rulebook or Meshwesh value is data, never a constant under `lib/`.** Movement, basing, battle
  card costs and the sub-faction overlay are JSON under `data/curation/` in the data repo, read through the schemas
  in `lib/data/curation.ts`; `buildBundle` puts them on the files it packs, and `lib/domain` reads
  them from the data it is given — `pointCosts`, `troopTypeProfiles`, `troopTypeMovements`. The
  cost-rule kinds, the overlay logic and the troop type codes stay in code. The same holds for
  Fantasy Triumph: its card codes and the cost-rule and constraint kinds in
  `lib/domain/fantasy/battle-cards.ts` are code; every price, eligibility list, name and line of
  rules text is under `data/curation/games/fantasy/`.
- **Forms are React Hook Form + zod**, through `@hookform/resolvers/zod`, validating on blur. One
  schema per form, and it is the same schema the server is configured from where there is a choice.
- Mobile-first: the builder is used standing at a table.
- **One spacing scale: `0.5 · 1 · 2 · 3 · 4 · 6`** (#109). Those are the only `gap-*` and
  `space-*` steps app code may use; `1.5`, `2.5`, `5` and `8` are gone. The page frame is
  `--page-gutter`, `--page-padding` and `--section-gap`, reached as `gutter`, `page` and
  `section`. `components/ui/` is vendored shadcn and keeps whatever it ships — do not sweep it.
- **One semantic colour vocabulary.** `--success`, `--warning`, `--info` and `--destructive` say
  *what a thing means*, and every one of them clears 4.5:1 as text on `--background`, on `--card`
  and on its own `/10` tint in light or `/20` in dark. Changing one means re-checking all three
  pairs. `--primary` is not a semantic colour: the points meter uses it for *under cap*, which is
  a neutral state, and switches to `--success`/`--destructive` only when the total means something.
- **One notice vocabulary.** `Alert` is a block callout and takes its variant from that
  vocabulary (`destructive`, `warning`, `info`, `success`, or `default` when the message carries
  no verdict); `Notice` is the inline message under a form field. Never hand-roll a coloured box.
- **One badge idiom.** `Badge` is a static label. A chip a player *toggles* is a `Button` with
  `aria-pressed` — that is the stated reason `ChipGroup` in `components/chip-group.tsx` looks like
  a badge and is not one. Never apply `badgeVariants()` to a bare `span`.
- **Four list-row treatments, and a fifth needs a reason.** `StackedTable` for tabular data — a
  header row from `sm:` up, a card per row below it. `FrozenTable` for rows a player compares
  column by column, which is the troop list on a shared list (#175): a real `<table>` at every
  width, its heading row and first column sticky, scrolling sideways inside itself on a phone.
  `ArmyRow` for the virtualised army index. `LinkCard` inside a `LinkCardGrid` for a grid of links
  to another page. Reference hub, categories and related armies are all the last one.
- **Every list has an empty state, and every empty state offers a way out.** `EmptyState` with
  `EmptyStateText`, and an action that widens whatever narrowed the list.
- **One focus treatment: `focus-visible:ring-2 focus-visible:ring-ring`.** Never a diluted ring —
  `ring-ring/30` is 1.3:1 and invisible. `--ring` is tuned to clear 3:1 against every surface.
- **44px on anything a player uses standing up**: `size="touch"` and `size="icon-touch"`, which is
  what the steppers, the year field, the search field and the filter chips are. A control that
  only ever sees a mouse may shrink from `sm:` up, never the other way round.
- **Voice.** Sentence case, including validation findings. `·` separates facts on one line, `–`
  spans a range, and a human-facing date is `formatDate` (`20 September 2026`) — there is no
  second date format. Every string says what happened and what it means for the player: the error
  boundary's *"Nothing you have saved is affected"* is the bar.
- `prefers-reduced-motion` is honoured globally in `app/globals.css`; a component never needs to
  opt in. Reflow is checked at 320 CSS px — the header wordmark drops *Army Builder* below
  `22rem` for exactly that reason.
- Biome formats and lints; single quotes, 2-space indent. A husky pre-commit hook fixes
  staged files and blocks on any remaining lint error. `scripts/format-on-save.sh` does the
  same for one file and is wired to the Claude Code `PostToolUse` hook in
  `.claude/settings.json`, so every file an agent writes is formatted and import-sorted.
  `.vscode/settings.json` does the same on save in the editor.
- **Conventional Commits** for all commit messages (`feat:`, `fix:`, `chore:`, `refactor:`, …).

## Docs

- **`README.md` is a front door, not a manual.** It says what the app is, how to run, test,
  configure and deploy it, and where the other docs are. A change touches it only when one of
  those changes — a new command a newcomer needs, a new environment variable, a new way to
  deploy. A feature, a fix, a new screen or a new rule does not: its behaviour is pinned by its
  tests, its scope lives on the issue, and a decision gets an ADR. Do not describe how a component
  behaves in `README.md`, and do not add a section per feature.
- `docs/DOMAIN.md` — domain model and data caveats. Read before touching `lib/domain/`.
- `docs/ROADMAP.md` — decisions taken, stack, labels and milestone order.
- Per-item scope and *done when* live on the GitHub issue, not in the repo: `gh issue view <n>`.
- `docs/adr/0016` — where the line between a UI test and an end-to-end one sits, and what the
  split costs in fidelity. Read it before adding a Playwright spec.
- `docs/adr/` — decisions that are expensive to reverse, with alternatives and a revisit trigger.
  Read the index before changing data flow, persistence, auth or deployment; add a record in the
  same change when you take a decision of that kind.
