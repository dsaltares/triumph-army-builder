# 0034 — Keep the reference data in SQLite, and serve it over tRPC

- **Status:** Accepted
- **Date:** 2026-09-29
- **Related:** #229, #232, #237, #238, ADR [0001](0001-snapshot-over-live-api.md), ADR
  [0003](0003-one-data-version-per-army.md), ADR
  [0009](0009-generated-static-bundle-with-an-eager-index.md), ADR
  [0011](0011-prerender-army-detail-from-the-bundle.md)

## Context

The app is going to be open source, and the reference data cannot go with it. The army lists,
troop types, battle cards and categories come from Meshwesh; movement and basing come from the
rulebook (ADR 0029, 0033). Today all of it is in the repo and in every build: the snapshot under
`data/snapshot/`, curated values as constants under `lib/`, and the generated bundle that
`yarn build` writes to `public/data/` and prerenders 656 army pages from (ADR 0009, 0011). Whoever
builds the image holds the data, and whoever clones the repo does too.

Every server-side reader already takes its data through one seam: `BundleSource`, passed as a
parameter to the tRPC context, `loadSharedView`, `loadSavedView`, `armySheetResponse` and the pages.
The client reads the same files through `bundleQueryOptions` in six components. Every read is
"give me this file" — the index, one army, the troop types — and filtering happens in the browser
(ADR 0009, 0019).

A saved list, a share and a share code each carry a `dataVersion` and ids into one version of the
data (ADR 0003). Today the running app only holds the current version, so an army saved against an
older one is read against whatever the current bundle can still resolve.

## Decision

The reference data lives in the database. Migration `010` adds `reference_versions`,
`reference_current` and `reference_documents`, one row per `(data_version, locale, path)` holding
the file the bundle writes today, as JSON. Every imported version is kept, and exactly one is
current.

`lib/db/reference.ts` implements `BundleSource` over those rows, memoised per current version, so
every server reader changes source without changing shape. The client reads through a public
`reference` tRPC router — `index`, `army`, `troopTypes`, `battleCards`, `battleCardText`,
`thematicCategories`, `tagWords` and `current`, each taking a locale — which mints no session. The current
data version is read at runtime, from `reference_current`, never compiled in. The client asks
`current` first and pins every read to the version it answers, so a batch of pinned reads is
cached publicly and for good, and one that follows the current version — `current` itself among
them — is cached for a minute. A new version is a new URL, never a stale answer, and a list is
never stamped with one version while it prices against another.

Army and category pages render on demand; `generateStaticParams` goes. `yarn build` reads no data,
so neither the build nor the image carries any.

This supersedes ADR 0009 and ADR 0011, and ADR 0001 where it ships the snapshot with the app. The
snapshot itself, the reviewed refresh and the rule that nothing at runtime calls Meshwesh all stand
(ADR 0035).

## Alternatives considered

- **Normalised tables — armies, options, entries.** A rewrite of the transform and every reader for
  queries nobody makes: the app asks for whole files and filters in the browser.
- **Keep generating files, from the database, at startup.** Keeps the static serving, and adds a
  second copy of the data that can disagree with the first, written by the server into its own
  image.
- **A separate reference service.** A second process and a network hop for a few megabytes that a
  single SQLite file already serves (ADR 0006, 0007).
- **Fetch the pack into memory at startup, no tables.** Loses every older version, which is the
  one thing the database gives ADR 0003 for free.

## Consequences

- The move is a change of source behind an existing seam, and can be proven so: the database
  source must return what the file source returns for every locale and path, and every saved list
  and share must read the same through both, before any read switches (#232, #234, #235).
- An army saved against an older version can be read against that version, as long as it was
  imported. ADR 0003's "anything unresolvable is an explicit unknown" becomes the case for
  versions older than this ADR only.
- Army pages are rendered per request instead of served as static HTML. They are one primary-key
  read and a parse memoised per version.
- The eager-payload budget is measured on the `reference.index` response instead of on
  `index.json`.
- A server without a current version has nothing to show, so it says so and fails its health
  check rather than rendering empty pages.
- Nothing is served from `public/data/` for a service worker to cache; offline reading (#50) would
  have to cache tRPC responses instead.

## Revisit trigger

A page needs a query across armies that a whole-file read cannot answer in the browser, or
rendering army pages on demand shows up in response times.
